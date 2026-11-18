"use server";

import { z } from "zod";

import { sinSesionAMano } from "@/lib/a-mano-reglas";
import { sinComando } from "@/lib/cola-reglas";
import { leerStock, marcarComando, PRODUCTO_YA_NO_ESTA, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { CAUSAS_CONTEO, CONTEO_MAXIMO, pedidoConteo } from "@/lib/voz/confirmar-conteo-reglas";

// Guardar un conteo físico (ADR-0028) por registrar_conteo: la base recalcula la diferencia con el stock de ese instante y, si no
// cuadra, deja la merma o el ajuste. Idempotente por comando: un segundo toque devuelve el mismo conteo. Necesita señal: sin ella no
// se puede comparar con lo que dice la app, así que no va a la cola del celular (CLAUDE.md, regla 10).

const confirmacionConteo = z.object({
  comandoId: z.number().int(),
  corregido: z.boolean(),
  latenciaMs: z.number().int().min(0).max(120_000),
  confirmadoPor: z.enum(["toque", "voz"]).default("toque"),
  aMano: z.boolean().optional(),
  /** Lo que decía la app cuando la persona comparó: si al guardar es otro, la base rechaza (P0C01). */
  segunApp: z.number(),
  borrador: z.object({
    producto: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    contado: z.number().min(0).max(CONTEO_MAXIMO).nullable(),
    causa: z.enum(CAUSAS_CONTEO).nullable(),
  }),
});

export type ResultadoConteo =
  | { ok: true; stock: number; diferencia: number }
  | { ok: false; error: string; sinSesion?: true; cambioElStock?: true };

/** El mensaje de la base cuando la diferencia cambió mientras se contaba (registrar_conteo, P0C01). */
const CAMBIO_EL_STOCK = "P0C01";

export async function confirmarConteo(entrada: z.input<typeof confirmacionConteo>): Promise<ResultadoConteo> {
  const leido = confirmacionConteo.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa la fruta y las cajas que contaste." };
  const { comandoId, borrador, corregido, latenciaMs, aMano, confirmadoPor, segunApp } = leido.data;
  // La hoja se abrió sin señal (comando solo del celular): el conteo no va a la cola, hay que abrirlo otra vez con señal.
  if (sinComando(comandoId)) return { ok: false, error: "Para guardar el conteo necesitas señal. Ciérralo y ábrelo otra vez cuando tengas." };
  const pedido = pedidoConteo(borrador, comandoId, segunApp);
  if (!pedido) return { ok: false, error: "Revisa la fruta y las cajas que contaste." };

  const s = await sesion();
  if (!s) return { ok: false, error: aMano ? sinSesionAMano("el conteo") : sinSesion("el conteo"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar conteos." };

  const { data, error } = await supabase.rpc("registrar_conteo", pedido);
  if (error) {
    console.error("conteo: no se pudo registrar", { comandoId, codigo: error.code });
    if (error.code === CAMBIO_EL_STOCK) {
      // Entró una venta o una compra mientras se contaba: la pantalla vuelve a leer el stock y pregunta otra vez.
      const ahora = await leerStock(supabase, pedido.p_producto_id);
      const dice = ahora === null ? "otra cosa" : ahora === 1 ? "1 caja" : `${ahora} cajas`;
      return { ok: false, error: `Mientras contabas cambió el stock: la app ahora dice ${dice}. Mira la diferencia otra vez.`, cambioElStock: true };
    }
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar conteos." };
    // El número no vale para la base (negativo o con más de dos decimales): no es la señal, es lo contado (/chaos 2026-11-18).
    if (error.code === "22023") return { ok: false, error: "Revisa las cajas que contaste: van de 0 para arriba, con hasta dos decimales." };
    if (error.code === "23503") return { ok: false, error: PRODUCTO_YA_NO_ESTA };
    return { ok: false, error: SIN_SENAL };
  }

  const r = z.object({ stock: z.coerce.number(), diferencia: z.coerce.number() }).safeParse(data);
  await marcarComando(supabase, comandoId, corregido, latenciaMs, confirmadoPor);
  // Ya está guardado: si la respuesta no se entiende, se dice lo contado (es lo que quedó en el stock).
  return r.success ? { ok: true, ...r.data } : { ok: true, stock: pedido.p_contado, diferencia: 0 };
}
