// Cuenta cuánto pinta y rasteriza el navegador en «Hoy» sin tocar nada durante 5 s. Una animación que solo mueve capas (transform, opacity)
// no repinta: da cero. Una que repinta cada cuadro (como animar una variable de un degradado) despierta CPU y GPU 60 veces por segundo.
// Uso:  pnpm build:local && pnpm medir:pintura <etiqueta>      (ESPERA_MS=9000 para medir ya en reposo, sin las animaciones de entrada;
// CSS="…" inyecta estilos para probar qué pasa sin una animación)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(process.cwd() + "/")("@playwright/test");

const etiqueta = process.argv[2] ?? "base";
const url = "http://127.0.0.1:3300";
const servidor = spawn("pnpm", ["exec", "next", "start", "-p", "3300"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { await fetch(`${url}/login`, { signal: AbortSignal.timeout(1000) }); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
}
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ baseURL: url, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-PE" });
if (process.env.CSS) {
  await contexto.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => { const e = document.createElement("style"); e.textContent = css; document.head.appendChild(e); });
  }, process.env.CSS);
}
const page = await contexto.newPage();
await page.goto("/login");
await page.waitForLoadState("networkidle");
await page.getByLabel("Correo").fill("duenio@puesto.test");
await page.getByLabel("Clave", { exact: true }).fill("puesto-prueba-2026");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(`${url}/`, { timeout: 30_000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(Number(process.env.ESPERA_MS ?? 2500));

const cdp = await contexto.newCDPSession(page);
const eventos = [];
cdp.on("Tracing.dataCollected", (d) => eventos.push(...d.value));
await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" });
await page.waitForTimeout(5000);
const fin = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
await cdp.send("Tracing.end");
await fin;

const cuenta = {};
for (const e of eventos) {
  if (e.ph !== "X" && e.ph !== "B") continue;
  const c = (cuenta[e.name] ??= { n: 0, ms: 0 });
  c.n++;
  c.ms += (e.dur ?? 0) / 1000;
}
const mira = ["Paint", "RasterTask", "UpdateLayoutTree", "Layout", "UpdateLayer", "CompositeLayers", "Commit", "ImageDecodeTask", "FunctionCall"];
const fila = Object.fromEntries(mira.map((k) => [k, { veces: cuenta[k]?.n ?? 0, ms: +(cuenta[k]?.ms ?? 0).toFixed(1) }]));
console.log(JSON.stringify({ etiqueta, en5s: fila }));
await navegador.close();
servidor.kill();
process.exit(0);
