// Qué puede hacer cada rol en la interfaz (CLAUDE.md, «Roles y RLS»). La seguridad de verdad es la RLS:
// esto solo evita mostrarle a alguien un botón que la base le va a rechazar.
import type { Database } from "@/lib/supabase/tipos-db";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

export type Permisos = {
  /** Dictar o registrar ventas, abonos, compras, mermas y gastos. */
  registrar: boolean;
  /** Anular una venta, un abono o una compra. */
  anular: boolean;
  /** Catálogo, precios y usuarios. */
  ajustes: boolean;
  /** Ver el cierre del día y exportar el mes. */
  cierre: boolean;
};

const nadie: Permisos = { registrar: false, anular: false, ajustes: false, cierre: false };

/** Sin rol (cuenta sin perfil o desactivada) no se puede nada. */
export function permisosDe(rol: Rol | null): Permisos {
  switch (rol) {
    case "duenio":
    case "administrador":
      return { registrar: true, anular: true, ajustes: true, cierre: true };
    case "ayudante":
      return { registrar: true, anular: false, ajustes: false, cierre: true };
    case "contador":
      return { registrar: false, anular: false, ajustes: false, cierre: true };
    default:
      return nadie;
  }
}

const nombres: Record<Rol, string> = {
  duenio: "Dueño",
  administrador: "Administrador",
  ayudante: "Ayudante",
  contador: "Contador",
};

/** Cómo se dice el rol en pantalla. */
export function nombreDelRol(rol: Rol): string {
  return nombres[rol];
}
