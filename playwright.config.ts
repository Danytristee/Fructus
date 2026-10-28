import { defineConfig } from "@playwright/test";

// Celular primero: se prueba al ancho del S25 Ultra del dueño y al de un Android
// de gama media. El escritorio se agrega cuando una pantalla lo necesite.
const celular = { isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "es-PE" } as const;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "s25-412", use: { ...celular, viewport: { width: 412, height: 915 } } },
    { name: "gama-media-360", use: { ...celular, viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
