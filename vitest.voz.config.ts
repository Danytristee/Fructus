import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// /voz-precision: corre tests/interprete contra el modelo REAL con el mismo lib/voz/interprete.ts que usa /api/voz.
// No va en `pnpm test` (gasta llamadas y depende de la red). Las claves salen de .env.local, nunca del repo.
// En el CI no hay .env.local (las claves nunca van al repo): ahí la config solo se lee (Knip), no se corre.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  test: {
    include: ["tests/interprete/**/*.voz.ts"],
    environment: "node",
    testTimeout: 30 * 60_000,
  },
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/interprete/sin-server-only.ts", import.meta.url)) },
  },
});
