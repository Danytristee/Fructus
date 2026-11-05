// Qué se sabe del perfil de quien mira la pantalla. Lógica pura: lib/sesion.ts hace la consulta y aquí se decide qué
// significa lo que volvió. La decisión importa: una caída de la base no es una cuenta sin acceso (CLAUDE.md, principio 8).
import { permisosDe, type Permisos, type Rol } from "./permisos-reglas";

export type EstadoPerfil<P extends { rol: Rol }> =
  /** El perfil existe y está activo. */
  | { estado: "activo"; perfil: P; permisos: Permisos }
  /** La base respondió y no hay perfil activo: la cuenta no puede nada hasta que el dueño la active. */
  | { estado: "inactivo"; perfil: null; permisos: Permisos }
  /** La base no respondió (sin señal, tope de 8 s): no se sabe quién es. `permisos` es null a propósito: así nadie
   * lo puede leer como «sin permisos» sin que el compilador lo avise. */
  | { estado: "sin-conexion"; perfil: null; permisos: null };

/** `huboError`: la consulta del perfil falló (no es lo mismo que «no hay fila»). Si falló, no se sabe nada de la cuenta. */
export function estadoDelPerfil<P extends { rol: Rol }>(perfil: P | null, huboError: boolean): EstadoPerfil<P> {
  if (huboError) return { estado: "sin-conexion", perfil: null, permisos: null };
  if (!perfil) return { estado: "inactivo", perfil: null, permisos: permisosDe(null) };
  return { estado: "activo", perfil, permisos: permisosDe(perfil.rol) };
}
