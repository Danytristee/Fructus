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
