import "server-only";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * La sesión de quien mira la pantalla, validada en el servidor. Sin sesión, manda a /login.
 * proxy.ts ya redirige antes, pero la guarda de verdad está aquí: el proxy puede no correr (caché, error de red).
 */
export async function exigirSesion() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error) console.error("sesion: no se pudo validar", { codigo: error.name });
  if (!data?.claims) redirect("/login");
  return { supabase, usuarioId: data.claims.sub };
}
