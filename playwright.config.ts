import { defineConfig } from "@playwright/test";

// Celular primero: se prueba al ancho del S25 Ultra del dueño y al de un Android
// de gama media. El escritorio se agrega cuando una pantalla lo necesite.
const celular = { isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "es-PE" } as const;

// Cada worktree puede correr su propio `pnpm dev` en otro puerto: `PUERTO=3100 pnpm e2e`. Sin esto, con otro worktree
// ya sirviendo el 3000, la prueba reusaba ese servidor y probaba el código de otra rama.
const puerto = process.env.PUERTO ?? "3000";
const inicio = `http://127.0.0.1:${puerto}`;

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
  webServer: {
    command: `pnpm dev --port ${puerto}`,
    url: inicio,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
