import { createBrowserClient } from "@supabase/ssr";

import { entornoSupabase } from "./entorno";
import type { Database } from "./tipos-db";

// Cliente para componentes "use client" (login, botón de voz). Solo lleva la
// publishable key: la seguridad la pone la RLS, no el navegador.
export function crearClienteNavegador() {
  const { url, clave } = entornoSupabase();
  return createBrowserClient<Database>(url, clave);
}
