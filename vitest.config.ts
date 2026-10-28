import { defineConfig } from "vitest/config";

// Vitest es para la lógica pura (lib/*-reglas.ts), con la prueba al lado del archivo.
// Las pruebas de pantalla van en tests/e2e con Playwright.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
