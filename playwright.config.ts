import { defineConfig } from "@playwright/test";

// Celular primero: se prueba al ancho del S25 Ultra del dueño y al de un Android
// de gama media. El escritorio se agrega cuando una pantalla lo necesite.
const celular = { isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "es-PE" } as const;

// Cada worktree puede correr su propio `pnpm dev` en otro puerto: `PUERTO=3100 pnpm e2e`. Sin esto, con otro worktree
// ya sirviendo el 3000, la prueba reusaba ese servidor y probaba el código de otra rama.
const puerto = process.env.PUERTO ?? "3000";
const inicio = `http://127.0.0.1:${puerto}`;

// El proveedor de comprobantes de mentira (tests/e2e/lucode-simulado.mjs) corre 200 puertos más arriba: 3000 → 3200.
const puertoLucode = Number(puerto) + 200;
// Y el servicio de avisos de mentira (tests/e2e/push-simulado.mjs), 300 más arriba: 3000 → 3300.
const puertoPush = Number(puerto) + 300;
// Y el modelo de mentira que estima la vida útil (tests/e2e/sonnet-simulado.mjs), 500 más arriba: 3000 → 3500 (el 3400 es de `pnpm e2e:prod`).
const puertoSonnet = Number(puerto) + 500;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Dos a la vez: corren contra `pnpm dev` (un solo proceso que compila y renderiza) y Supabase en Docker. Con 5 en
  // paralelo, las llamadas a Auth pasaban el tope de 8 s de la app y las pruebas fallaban sin que la app tuviera la culpa.
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: inicio,
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    // Un micrófono falso que acepta el permiso solo: el botón de voz graba de verdad (un tono) y /api/voz se simula.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "s25-412", use: { ...celular, viewport: { width: 412, height: 915 } } },
    { name: "gama-media-360", use: { ...celular, viewport: { width: 360, height: 800 } } },
  ],
  webServer: [
    {
      command: `pnpm dev --port ${puerto}`,
      url: inicio,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // La app emite comprobantes contra el Lucode simulado, no contra el sandbox de verdad. Si ya hay un `pnpm dev` corriendo, no
      // recibe esto: córrelo con `PUERTO=3100 pnpm e2e` para que Playwright levante el suyo.
      env: {
        LUCODE_API_URL: `http://127.0.0.1:${puertoLucode}`,
        LUCODE_TOKEN: "token-de-prueba",
        EMISOR_RUC: "20600000001",
        EMISOR_RAZON_SOCIAL: "Frutas La Hermelinda SAC (prueba)",
        // Dos segundos en vez de diez: así «el proveedor no contestó a tiempo» se prueba sin esperar.
        LUCODE_TOPE_MS: "2000",
        // El aviso del día sale hacia el servicio de avisos de mentira, no hacia Google, Apple ni Mozilla.
        PUSH_SIMULADOR_URL: `http://127.0.0.1:${puertoPush}`,
        // La estimación de vida útil le pregunta al modelo de mentira, no a Anthropic: no gasta créditos y contesta siempre igual.
        ANTHROPIC_API_KEY: "clave-de-prueba",
        VIDA_UTIL_SIMULADOR_URL: `http://127.0.0.1:${puertoSonnet}`,
        // Sin la consulta de avisos de npm (next.config.ts): con un aviso nuevo, la píldora de Next tapaba la barra de abajo y rompía las pruebas.
        PRUEBAS_E2E: "1",
      },
    },
    {
      command: "node tests/e2e/lucode-simulado.mjs",
      url: `http://127.0.0.1:${puertoLucode}/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
      env: { PUERTO_LUCODE: String(puertoLucode) },
    },
    {
      command: "node tests/e2e/push-simulado.mjs",
      url: `http://127.0.0.1:${puertoPush}/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
      env: { PUERTO_PUSH: String(puertoPush) },
    },
    {
      command: "node tests/e2e/sonnet-simulado.mjs",
      url: `http://127.0.0.1:${puertoSonnet}/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
      env: { PUERTO_SONNET: String(puertoSonnet) },
    },
  ],
});
