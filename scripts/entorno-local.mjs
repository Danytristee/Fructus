// Corre un comando con el entorno de la base LOCAL (.env.development.local) en vez del de .env.local, que apunta al proyecto de verdad.
//   node scripts/entorno-local.mjs pnpm exec next build
// Sirve para compilar la app contra la base local: las claves públicas (NEXT_PUBLIC_*) quedan escritas en el JavaScript al compilar, y
// `next build` solo lee .env.local. (`node --env-file` no sirve: Next lo copia a sus procesos hijos y Node no lo permite ahí.)
import { spawnSync } from "node:child_process";

const archivo = ".env.development.local";
try {
  process.loadEnvFile(archivo); // no pisa lo que ya esté en el entorno
} catch {
  console.error(`Falta ${archivo}: es la base local de Supabase (npx supabase start). Sin ella no se compila contra otra base.`);
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL no apunta a la base local (${url.slice(0, 40)}…). Me niego a seguir.`);
  process.exit(1);
}
const [comando, ...argumentos] = process.argv.slice(2);
if (!comando) {
  console.error("Uso: node scripts/entorno-local.mjs <comando> [argumentos]");
  process.exit(1);
}
const resultado = spawnSync(comando, argumentos, { stdio: "inherit", env: process.env });
process.exit(resultado.status ?? 1);
