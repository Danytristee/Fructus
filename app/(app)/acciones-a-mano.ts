"use server";

import { z } from "zod";

import { NO_ABRIO } from "@/lib/a-mano-reglas";
import { sesion } from "@/lib/voz/accion-servidor";

// Registrar a mano (A8). Las tarjetas guardan de forma idempotente por «comando» (un abono, una merma, un gasto o una
// compra por comando: el índice único de cada tabla manda). Sin voz no hay comando, así que cada hoja abre uno «a
// mano» al abrirse: un doble toque, o un reintento tras una respuesta perdida, vuelve al mismo comando y no guarda dos
// veces. Se reconoce porque modelo_stt es «manual»: la precisión de la voz se mide sin ellos.

const INTENCIONES = ["registrar_abono", "registrar_merma", "registrar_compra", "registrar_gasto"] as const;
export type IntencionAMano = (typeof INTENCIONES)[number];

export type ResultadoComandoAMano = { ok: true; comandoId: number } | { ok: false; error: string; sinSesion?: true };

/** Abre el comando de lo que la persona va a registrar a mano. Lo puede abrir quien puede registrar (no el contador). */
export async function abrirComandoAMano(intencion: IntencionAMano): Promise<ResultadoComandoAMano> {
  const leida = z.enum(INTENCIONES).safeParse(intencion);
  if (!leida.success) return { ok: false, error: NO_ABRIO };

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar.", sinSesion: true };
  if (!s.permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar operaciones." };

  const { data, error } = await s.supabase
    .from("comandos_voz")
    .insert({ transcripcion: "(a mano)", intencion: leida.data, modelo_stt: "manual" })
    .select("id")
    .single();
  if (error || !data) {
    console.error("a mano: no se pudo abrir el comando", { intencion: leida.data, codigo: error?.code });
    return { ok: false, error: NO_ABRIO };
  }
  return { ok: true, comandoId: data.id };
}
