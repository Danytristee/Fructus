// Cuánto le cuesta al celular que «Hoy» escuche «Hola Fructus» (actividad 5e): la CPU de TODOS los procesos del navegador con «Hoy» en
// reposo, con la escucha prendida y apagada. La diferencia es el micrófono, el AudioWorklet y el detector en su worker. El micrófono es el
// falso de Chrome (un pitido): el detector trabaja igual con cualquier sonido.
//
// Uso:  pnpm build:local && pnpm medir:escucha
// En una computadora el número sirve para comparar (prendida contra apagada, un modelo contra otro); el de verdad se mide en el celular.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(process.cwd() + "/")("@playwright/test");
const PUERTO = 3301;
const REPOSO_MS = 15_000;

const servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(PUERTO)], { stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try {
    await fetch(`http://127.0.0.1:${PUERTO}/login`, { signal: AbortSignal.timeout(1000) });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
const navegador = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const cdp = await navegador.newBrowserCDPSession();
const cpu = async () => (await cdp.send("SystemInfo.getProcessInfo")).processInfo.reduce((s, x) => s + x.cpuTime, 0);

async function medir(prendida) {
  const contexto = await navegador.newContext({
    baseURL: `http://127.0.0.1:${PUERTO}`,
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-PE",
  });
  await contexto.addInitScript((p) => {
    if (p) localStorage.setItem("fructus:hola-fructus", "si");
  }, prendida);
  const pagina = await contexto.newPage();
  await pagina.goto("/login");
  await pagina.waitForLoadState("networkidle");
  await pagina.getByLabel("Correo").fill("duenio@puesto.test");
  await pagina.getByLabel("Clave", { exact: true }).fill("puesto-prueba-2026");
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await pagina.waitForURL(`http://127.0.0.1:${PUERTO}/`, { timeout: 30_000 });
  await pagina.waitForLoadState("networkidle");
  if (prendida) await pagina.locator("button[data-palabra]").waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(4000); // que termine de pintar y de cargar
  const antes = await cpu();
  await pagina.waitForTimeout(REPOSO_MS);
  const gasto = (await cpu()) - antes;
  await contexto.close();
  return gasto / (REPOSO_MS / 1000); // núcleos ocupados, en promedio
}

const apagada = await medir(false);
const prendida = await medir(true);
const fmt = (n) => `${(n * 100).toFixed(1)} % de un núcleo`;
console.log(`«Hoy» en reposo, ${REPOSO_MS / 1000} s, CPU de todos los procesos del navegador:`);
console.log(`  escucha apagada:  ${fmt(apagada)}`);
console.log(`  escucha prendida: ${fmt(prendida)}`);
console.log(`  lo que cuesta escuchar: ${fmt(prendida - apagada)}`);
await navegador.close();
servidor.kill();
process.exit(0);
