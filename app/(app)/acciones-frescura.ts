"use server";

import { z } from "zod";

import { sinSesionAMano } from "@/lib/a-mano-reglas";
import { esDeEstaLlegada, sePasoDeSuDia } from "@/lib/frescura-reglas";
import { leerInventario } from "@/lib/inventario";
import { GRADOS_MAXIMO, GRADOS_MINIMO } from "@/lib/temperatura-reglas";
import { ESTADOS_LLEGADA } from "@/lib/vida-util-reglas";
import { conFecha, marcarComando, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { pedidoTemperatura } from "@/lib/voz/confirmar-temperatura-reglas";

// Guardar lo del aviso de frescura: la temperatura que marca el termómetro del puesto y la revisión de una llegada que pasó
// su día («Sigue buena»). Las dos son idempotentes: un segundo toque, o un reintento tras una respuesta que no llegó,
// devuelve lo mismo y no guarda dos veces (el índice único de cada tabla manda). La RLS es la seguridad.

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

export type ResultadoRevision = { ok: true } | { ok: false; error: string; sinSesion?: true };

const revision = z.object({
  productoId: z.number().int().positive(),
  /** El día de Lima en que llegó esa llegada; null = las cajas de hace más de 45 días. */
  llegadaDia: z.iso.date().nullable(),
  estado: z.enum(ESTADOS_LLEGADA).nullable(),
});

const YA_NO = "Esa llegada ya no está por revisar. Mira Stock otra vez.";
const NO_PUEDE = "Tu cuenta no puede anotar esto.";

/**
 * «Sigue buena»: anota que alguien miró una llegada que ya pasó su último día bueno y la encontró vendible. Con eso sale de
 * «para hoy» y queda como «sale mañana»; mañana se vuelve a preguntar. No toca el stock ni la vida de la fruta.
 * Antes de anotar se mira el inventario de ahora: solo vale para una llegada que sigue en el puesto y que ya se pasó. Así
 * un toque sobre una pantalla vieja (ya se vendió, ya se anotó la merma) no deja una revisión de cajas que no están, que
 * después contaría como evidencia de que esa fruta dura más.
 */
export async function anotarSigueBuena(entrada: z.input<typeof revision>): Promise<ResultadoRevision> {
  const leido = revision.safeParse(entrada);
  if (!leido.success) return { ok: false, error: YA_NO };
  const { productoId, llegadaDia, estado } = leido.data;

  const s = await sesion();
  if (!s) return { ok: false, error: sinSesionAMano("que sigue buena"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: NO_PUEDE };

  let lotes;
  try {
    lotes = (await leerInventario(supabase)).estados.find((e) => e.id === productoId)?.lotes ?? [];
  } catch (e) {
    console.error("frescura: no se pudo leer el inventario para anotar la revisión", { productoId, error: e instanceof Error ? e.message : "desconocido" });
    return { ok: false, error: SIN_SENAL };
  }
  const lote = lotes.find((l) => esDeEstaLlegada({ llegadaDia, estado }, l));
  if (lote?.revisada) return { ok: true }; // ya la anotó alguien hoy (otro toque, otro celular): es lo mismo
  if (!lote || !sePasoDeSuDia(lote)) return { ok: false, error: YA_NO };

  const { error } = await supabase.from("revisiones_frescura").insert({ producto_id: productoId, llegada_dia: llegadaDia, llegada_estado: estado });
  if (error && error.code !== YA_GUARDADO) {
    console.error("frescura: no se pudo anotar la revisión", { productoId, codigo: error.code });
    return { ok: false, error: error.code === "42501" ? NO_PUEDE : SIN_SENAL };
  }
  return { ok: true };
}
