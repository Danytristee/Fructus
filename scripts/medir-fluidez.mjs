// Mide la fluidez de la app compilada (next start) como la sentiría un Android de gama media: CPU 4 veces más lenta, 412 × 915.
// Uso:  pnpm build:local && pnpm medir:fluidez <etiqueta>      (compila y sirve contra la base LOCAL: entra como el dueño de prueba)
// Escribe test-results/medidas-fluidez-<etiqueta>.json. Los números sirven para comparar antes y después, con la máquina igual de libre
// (alternando las dos versiones, varias veces), no como valores absolutos: el Chromium sin pantalla pinta por software.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// Playwright vive en el worktree (el cwd), no junto a este archivo.
const { chromium } = createRequire(process.cwd() + "/")("@playwright/test");

const etiqueta = process.argv[2] ?? "base";
const salida = join(process.cwd(), "test-results");
mkdirSync(salida, { recursive: true });
const puerto = 3300;
const url = `http://127.0.0.1:${puerto}`;

const servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(puerto)], { stdio: "ignore" });
const salir = (codigo) => {
  servidor.kill();
  process.exit(codigo);
};
process.on("SIGINT", () => salir(1));

for (let i = 0; i < 60; i++) {
  try {
    await fetch(`${url}/login`, { signal: AbortSignal.timeout(1000) });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

const navegador = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const contexto = await navegador.newContext({
  baseURL: url,
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "es-PE",
  timezoneId: "America/Lima",
});
// Para experimentar: CSS="…" inyecta estilos en todas las páginas (por ejemplo, apagar una animación) y mide lo que cambia.
if (process.env.CSS) {
  await contexto.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const e = document.createElement("style");
      e.textContent = css;
      document.head.appendChild(e);
    });
  }, process.env.CSS);
}
const page = await contexto.newPage();

// Entrar como el dueño de prueba.
await page.goto("/login");
await page.waitForLoadState("networkidle");
await page.getByLabel("Correo").fill("duenio@puesto.test");
await page.getByLabel("Clave", { exact: true }).fill("puesto-prueba-2026");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(`${url}/`, { timeout: 30_000 });

const cdp = await contexto.newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const metrica = async (nombre) => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === nombre)?.value ?? 0;

// Mide los cuadros que se dibujan durante `ms` (rAF): cuántos pasan de 20 ms (se nota) y de 33 ms (se ve trabado).
async function cuadros(ms, durante) {
  await page.evaluate(() => {
    window.__cuadros = [];
    let antes = performance.now();
    const paso = (t) => {
      window.__cuadros.push(t - antes);
      antes = t;
      if (window.__midiendo) requestAnimationFrame(paso);
    };
    window.__midiendo = true;
    requestAnimationFrame(paso);
  });
  const tarea0 = await metrica("TaskDuration");
  const t0 = Date.now();
  if (durante) await durante();
  const resto = ms - (Date.now() - t0);
  if (resto > 0) await page.waitForTimeout(resto);
  const tarea1 = await metrica("TaskDuration");
  const lista = await page.evaluate(() => {
    window.__midiendo = false;
    return window.__cuadros.slice(2);
  });
  const orden = [...lista].sort((a, b) => a - b);
  const pct = (p) => orden[Math.min(orden.length - 1, Math.floor(orden.length * p))] ?? 0;
  return {
    cuadros: lista.length,
    fps: +(lista.length / (ms / 1000)).toFixed(1),
    p50: +pct(0.5).toFixed(1),
    p95: +pct(0.95).toFixed(1),
    peor: +Math.max(...lista, 0).toFixed(1),
    sobre20ms: lista.filter((d) => d > 20).length,
    sobre33ms: lista.filter((d) => d > 33).length,
    // Cuánto del tiempo el hilo principal estuvo ocupado (con la CPU 4× más lenta).
    ocupado: +(((tarea1 - tarea0) / (ms / 1000)) * 100).toFixed(1),
  };
}

const resultado = { etiqueta, rutas: {} };

// 1 · «Hoy» en reposo: el orbe se mueve solo.
await page.goto("/");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
resultado.hoyEnReposo = await cuadros(5000);

// 2 · Cargas en frío de cada pantalla: LCP, JS que bajó y tareas largas.
for (const ruta of ["/", "/clientes", "/stock", "/ventas"]) {
  const p = await contexto.newPage();
  const c = await contexto.newCDPSession(p);
  await c.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    window.__largas = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas += e.duration;
    }).observe({ type: "longtask", buffered: true });
  });
  await p.goto(ruta, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  resultado.rutas[ruta] = await p.evaluate(() => {
    const recursos = performance.getEntriesByType("resource");
    const js = recursos.filter((r) => r.name.endsWith(".js") || r.initiatorType === "script");
    return {
      lcp: Math.round(window.__lcp),
      tareasLargasMs: Math.round(window.__largas),
      jsKB: +(js.reduce((s, r) => s + (r.encodedBodySize || 0), 0) / 1024).toFixed(1),
      peticiones: recursos.length,
    };
  });
  await p.close();
}

// 3 · Abrir una hoja (la de «Compra» en Stock): sube con un resorte; es la animación que más se ve.
await page.goto("/stock");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
resultado.abrirHoja = await cuadros(1400, async () => {
  await page.getByRole("button", { name: /Compra/ }).first().click();
});
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// 4 · Deslizar la lista de ventas con el dedo.
await page.goto("/ventas");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
resultado.deslizarVentas = await cuadros(3000, async () => {
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(190);
  }
});

writeFileSync(join(salida, `medidas-fluidez-${etiqueta}.json`), JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
await navegador.close();
salir(0);
