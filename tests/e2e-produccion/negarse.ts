// Corta las pruebas de producción antes de la primera cuando falta la base local (playwright.produccion.config.ts): nunca se prueba
// contra el proyecto de Supabase de verdad. Con la base local, no hace nada.
export default function negarse() {
  const problema = process.env.PRUEBAS_PRODUCCION_PROBLEMA;
  if (problema) throw new Error(problema);
}
