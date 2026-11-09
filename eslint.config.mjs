import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // CLAUDE.md: «Nada de `any`».
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Skills de Claude: sus ejemplos no son código de la app (ADR-0004).
    ".claude/**",
    // Generado por `supabase gen types`; no se edita a mano.
    "lib/supabase/tipos-db.ts",
    // Maquetas tocables (HTML, CSS y JS sueltos para mirar un diseño): no son código de la app.
    "docs/maquetas/**",
  ]),
]);

export default eslintConfig;
