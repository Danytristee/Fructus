import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

// Las variables de la base local (npx supabase start). Solo para pruebas: nunca apunta al proyecto.
export function entornoLocal(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(".env.development.local", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

/** Un cliente con la secret key local: lee la verdad de la base para compararla con la pantalla. */
export function baseLocal() {
  const e = entornoLocal();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const clave = e.SUPABASE_SECRET_KEY;
  if (!url || !clave || !url.includes("127.0.0.1")) throw new Error("Las pruebas solo corren contra la base local");
  return createClient(url, clave, { auth: { persistSession: false } });
}

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
/** Igual que formatearSoles() de la app: espacio duro después de «S/». */
export const enSoles = (monto: number) => soles.format(monto).replace(/\s/, " ");

/**
 * El contenedor de Postgres de la base local. Por defecto, el de `npx supabase start`. Si este worktree levantó la suya aparte
 * (otro `project_id` y otros puertos, para no pisarse con otra sesión que esté usando la compartida), su nombre va en
 * `SUPABASE_DB_CONTENEDOR` de `.env.development.local`, junto a la URL que apunta a ella.
 */
function contenedorDeLaBase(): string {
  const nombre = entornoLocal().SUPABASE_DB_CONTENEDOR || "supabase_db_fructus";
  if (!/^[\w.-]+$/.test(nombre)) throw new Error("SUPABASE_DB_CONTENEDOR no es un nombre de contenedor");
  return nombre;
}

/** Corre scripts/invariantes.sql contra la base local: «limpias» o la violación. Después de todo lo que escribe, para que no quede un descuadre que nadie vea. */
export function invariantes(): string {
  try {
    execSync(`docker exec -i ${contenedorDeLaBase()} psql -U postgres -v ON_ERROR_STOP=1 < scripts/invariantes.sql`, { stdio: "pipe", shell: "/bin/bash" });
    return "limpias";
  } catch (e) {
    return `VIOLACIÓN: ${String((e as { stderr?: Buffer }).stderr).slice(0, 300)}`;
  }
}
