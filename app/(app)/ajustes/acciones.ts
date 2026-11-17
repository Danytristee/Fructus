"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { desdeCuandoRige, esHoraDeCierre } from "@/lib/hora-cierre-reglas";
import { SIN_SENAL, sesion } from "@/lib/voz/accion-servidor";

// Lo que se cambia desde Ajustes. Por ahora, la hora de cierre del puesto (ADR-0023): a qué hora le llega a cada teléfono el resumen del
// día. La cambian solo el dueño y el administrador; la función de la base lo vuelve a revisar (la guarda de verdad es la base).

export type ResultadoHoraDeCierre = { ok: true; hora: number; desde: "hoy" | "mañana" } | { ok: false; error: string; sinSesion?: true };

const esquema = z.number().int().refine(esHoraDeCierre);

export async function fijarHoraDeCierre(datos: unknown): Promise<ResultadoHoraDeCierre> {
  const leida = esquema.safeParse(datos);
  if (!leida.success) return { ok: false, error: "Esa hora no se puede elegir. Elige una entre las 8 a. m. y las 11 p. m." };

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y elige la hora otra vez.", sinSesion: true };
  if (!s.permisos.ajustes) return { ok: false, error: "Solo el dueño o el administrador pueden cambiar la hora de cierre." };

  const { error } = await s.supabase.rpc("fijar_hora_cierre", { p_hora: leida.data });
  if (error) {
    console.error("ajustes: no se pudo guardar la hora de cierre", { usuarioId: s.usuarioId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Solo el dueño o el administrador pueden cambiar la hora de cierre." };
    return { ok: false, error: SIN_SENAL };
  }
  revalidatePath("/ajustes");
  return { ok: true, hora: leida.data, desde: desdeCuandoRige(leida.data, new Date()) };
}
