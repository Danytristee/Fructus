import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * La sesión de quien mira la pantalla, validada en el servidor, con su perfil y lo que puede hacer.
 * Sin sesión, manda a /login. proxy.ts ya redirige antes, pero la guarda de verdad está aquí: el proxy puede no correr.
 * `cache` hace que el layout, la página y el encabezado compartan una sola consulta por pedido.
 */
export const exigirSesion = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error) console.error("sesion: no se pudo validar", { codigo: error.name });
  if (!data?.claims) redirect("/login");

  const usuarioId = data.claims.sub;
  // La RLS deja leer el perfil propio. Si no existe o está inactivo, la cuenta no puede nada.
  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", usuarioId)
    .eq("activo", true)
    .maybeSingle();
  if (errorPerfil) console.error("sesion: no se pudo leer el perfil", { usuarioId, codigo: errorPerfil.code });

  return { supabase, usuarioId, perfil, permisos: permisosDe(perfil?.rol ?? null) };
});
