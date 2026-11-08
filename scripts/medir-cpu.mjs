// Cuánta CPU gastan TODOS los procesos del navegador (pantalla, GPU, red) mientras la pantalla se desliza o está en reposo: el costo real
// de lo que se pinta, incluido el desenfoque del vidrio, que el hilo principal no ve.
// Uso:  pnpm build:local && pnpm medir:cpu <etiqueta> <ruta>      (CSS="…" inyecta estilos para probar qué pasa sin algo)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(process.cwd() + "/")("@playwright/test");
const etiqueta = process.argv[2] ?? "x";
const ruta = process.argv[3] ?? "/ventas";
const servidor = spawn("pnpm", ["exec", "next", "start", "-p", "3300"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { await fetch("http://127.0.0.1:3300/login", { signal: AbortSignal.timeout(1000) }); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
const b = await chromium.launch();
const c = await b.newContext({ baseURL: "http://127.0.0.1:3300", viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-PE" });
if (process.env.CSS) await c.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const e = document.createElement("style"); e.textContent = css; document.head.appendChild(e); }), process.env.CSS);
const p = await c.newPage();
await p.goto("/login"); await p.waitForLoadState("networkidle");
await p.getByLabel("Correo").fill("duenio@puesto.test");
await p.getByLabel("Clave", { exact: true }).fill("puesto-prueba-2026");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("http://127.0.0.1:3300/", { timeout: 30000 });
await p.goto(ruta); await p.waitForLoadState("networkidle"); await p.waitForTimeout(9000);
const nav = await b.newBrowserCDPSession();
const cpu = async () => { const { processInfo } = await nav.send("SystemInfo.getProcessInfo"); return processInfo.reduce((s, x) => s + x.cpuTime, 0); };
const medidas = [];
for (let r = 0; r < 5; r++) {
  await p.mouse.wheel(0, -6000); await p.waitForTimeout(600);
  const t0 = await cpu();
  for (let i = 0; i < 16; i++) { await p.mouse.wheel(0, 150); await p.waitForTimeout(180); }
  medidas.push(+((await cpu()) - t0).toFixed(3));
}
medidas.sort((x, y) => x - y);
console.log(etiqueta, ruta, "CPU de todos los procesos en 2.9 s de deslizar (s):", medidas.join(" "), "mediana", medidas[2]);
await b.close(); servidor.kill(); process.exit(0);
