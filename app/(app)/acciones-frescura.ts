"use server";

import { z } from "zod";

import { sinSesionAMano } from "@/lib/a-mano-reglas";
import { GRADOS_MAXIMO, GRADOS_MINIMO } from "@/lib/temperatura-reglas";
import { conFecha, marcarComando, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { pedidoTemperatura } from "@/lib/voz/confirmar-temperatura-reglas";

// Guardar lo del aviso de frescura: por ahora, la temperatura que marca el termómetro del puesto. Como las demás
// operaciones dictadas, es idempotente por comando: un segundo toque, o un reintento tras una respuesta que no llegó,
// devuelve lo mismo y no guarda dos veces (el índice único de `temperaturas` manda). La RLS es la seguridad.

const YA_GUARDADO = "23505";

export type ResultadoTemperatura = { ok: true } | { ok: false; error: string; sinSesion?: true };

const confirmacionTemperatura = z.object({
  comandoId: z.number().int().positive(),
  corregido: z.boolean(),
  latenciaMs: z.number().int().min(0).max(120_000),
  /** La hora del toque, si viene de la cola sin conexión (ADR-0019). */
  fecha: z.iso.datetime({ offset: true }).optional(),
  /** Anotada a mano: con la sesión vencida, la frase cambia porque a mano no queda nada esperando en «Hoy». */
  aMano: z.boolean().optional(),
  borrador: z.object({ grados: z.number().min(GRADOS_MINIMO).max(GRADOS_MAXIMO) }),
});

const REVISA = "Eso no parece una temperatura. Revisa lo que marca el termómetro.";

/** Guarda lo que marca el termómetro. Corregir es anotar otra: la temperatura del día es su última lectura. */
export async function confirmarTemperatura(entrada: z.input<typeof confirmacionTemperatura>): Promise<ResultadoTemperatura> {
  const leido = confirmacionTemperatura.safeParse(entrada);
  if (!leido.success) return { ok: false, error: REVISA };
  const { comandoId, borrador, corregido, latenciaMs, aMano, fecha } = leido.data;
  const pedido = pedidoTemperatura(borrador, comandoId);
  if (!pedido) return { ok: false, error: REVISA };

  const s = await sesion();
  if (!s) return { ok: false, error: aMano ? sinSesionAMano("la temperatura") : sinSesion("la temperatura"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede anotar la temperatura." };

  const { error } = await supabase.from("temperaturas").insert(conFecha(pedido, fecha));
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo anotar la temperatura", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede anotar la temperatura." };
    if (error.code === "23514") return { ok: false, error: REVISA };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs);
  return { ok: true };
}
