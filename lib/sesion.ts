import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { estadoDelPerfil } from "@/lib/sesion-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * La sesión de quien mira la pantalla, validada en el servidor, con su perfil y lo que puede hacer.
 * Sin sesión, manda a /login. proxy.ts ya redirige antes, pero la guarda de verdad está aquí: el proxy puede no correr.
 * `cache` hace que el layout, la página y el encabezado compartan una sola consulta por pedido.
 *
 * `estado` dice qué se sabe del perfil: «activo», «inactivo» (la base respondió y no hay perfil activo) o
 * «sin-conexion» (la base no respondió: no se sabe). Son tres casos distintos: una caída no es una cuenta sin acceso.
 * En «sin-conexion» `permisos` es null, así que una pantalla que decide según el rol está obligada a mirarlo.
 */
export const exigirSesion = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error) console.error("sesion: no se pudo validar", { codigo: error.name });
  if (!data?.claims) redirect("/login");

  const usuarioId = data.claims.sub;
  // La RLS deja leer el perfil propio. Si la base respondió y no hay fila, la cuenta no puede nada («inactivo»).
  // Si la consulta falló (sin señal, tope de 8 s), no se sabe: «sin-conexion», no «inactivo».
  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", usuarioId)
    .eq("activo", true)
    .maybeSingle();
  if (errorPerfil) console.error("sesion: no se pudo leer el perfil", { usuarioId, codigo: errorPerfil.code });

  return { supabase, usuarioId, ...estadoDelPerfil(perfil, errorPerfil !== null) };
});
