import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: [
    // Skills de Claude (propias y de terceros, ADR-0004): traen ejemplos que no son código de la app.
    ".claude/**",
    // Generado por `supabase gen types`: exporta ayudantes que no siempre se usan.
    "lib/supabase/tipos-db.ts",
    // Lo usan el login y el botón de voz (A2 y A5). Se quita de aquí cuando A2 lo importe.
    "lib/supabase/navegador.ts",
  ],
  // `say` es la voz del Mac con que /voz-precision fabrica audios de prueba (tests/interprete/stt.voz.ts); no es de npm.
  ignoreBinaries: ["say"],
  // shadcn/ui es materia prima (ADR-0005): genera exportaciones que components/ui/ todavía no usa.
  ignoreIssues: { "components/shadcn/**": ["exports", "types"] },
};

export default config;
