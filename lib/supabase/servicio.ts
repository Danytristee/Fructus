import "server-only";

import { createClient } from "@supabase/supabase-js";

import { fetchWithTimeout } from "./fetch-con-tope";
import type { Database } from "./tipos-db";

/**
 * Cliente con la llave de servicio (`SUPABASE_SECRET_KEY`): salta la RLS. Solo para lo que la RLS reserva al servidor, como
 * reservar el número de un comprobante (CLAUDE.md, «Roles y RLS»). Quien lo llama ya comprobó, con la sesión de la persona,
 * que puede hacer lo que va a hacer. Nunca se importa desde un componente de cliente (`server-only`) y la llave jamás se
 * escribe en un log ni en un mensaje.
 */
export function crearClienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example)");
  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
