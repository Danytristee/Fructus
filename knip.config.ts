import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: [
    // Skills de Claude (propias y de terceros, ADR-0004): traen ejemplos que no son código de la app.
    ".claude/**",
    // Maquetas tocables (HTML, CSS y JS sueltos para mirar un diseño): no son código de la app.
    "docs/maquetas/**",
    // Generado por `supabase gen types`: exporta ayudantes que no siempre se usan.
    "lib/supabase/tipos-db.ts",
    // El service worker lo registra RegistroPwa con su ruta escrita como texto ("/sw.js"), no con un import.
    "public/sw.js",
    // Lo mismo con el AudioWorklet de «Hola Fructus»: useHolaFructus lo carga con audioWorklet.addModule("/voz/captura-worklet.js").
    "public/voz/captura-worklet.js",
    // Se corren con `pnpm medir:*`, a través de scripts/entorno-local.mjs (ADR-0012): Knip no ve el script dentro de otro comando.
    "scripts/medir-cpu.mjs",
    "scripts/medir-fluidez.mjs",
    "scripts/medir-pintura.mjs",
    // Lo usan el login y el botón de voz (A2 y A5). Se quita de aquí cuando A2 lo importe.
    "lib/supabase/navegador.ts",
  ],
  // `say` es la voz del Mac con que /voz-precision fabrica audios de prueba (tests/interprete/stt.voz.ts); no es de npm.
  ignoreBinaries: ["say"],
  // shadcn/ui es materia prima (ADR-0005): genera exportaciones que components/ui/ todavía no usa.
  ignoreIssues: { "components/shadcn/**": ["exports", "types"] },
};

export default config;
