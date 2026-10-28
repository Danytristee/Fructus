import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { entornoSupabase } from "./entorno";
import { fetchWithTimeout } from "./fetch-con-tope";
import type { Database } from "./tipos-db";

// Cliente para Server Components, route handlers y server actions. Usa la
// sesión de la persona (cookies), así que la RLS decide qué ve y qué escribe.
export async function crearClienteServidor() {
  const { url, clave } = entornoSupabase();
  const almacen = await cookies();

  return createServerClient<Database>(url, clave, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacen.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies: Next lanza aquí a
          // propósito. La sesión la refresca proxy.ts en cada navegación,
          // así que no se pierde nada.
        }
      },
    },
  });
}
