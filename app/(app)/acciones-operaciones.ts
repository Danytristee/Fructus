"use server";

import { z } from "zod";

import { leerSaldo, marcarComando, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { ABONO_MAXIMO, pedidoAbono } from "@/lib/voz/confirmar-abono-reglas";

// Guardar lo que no es una venta: abonos, mermas, gastos y compras dictados (A6). Cada uno es idempotente por comando:
// un segundo toque, o un reintento tras una respuesta que no llegó, devuelve lo mismo y no guarda dos veces (el índice
// único de cada tabla manda; aquí se lee el choque como «ya estaba guardado»). La RLS es la seguridad.

const medio = z.enum(["efectivo", "yape", "plin", "transferencia"]);
const comun = {
  comandoId: z.number().int().positive(),
  corregido: z.boolean(),
  latenciaMs: z.number().int().min(0).max(120_000),
};
const YA_GUARDADO = "23505";

export type ResultadoAbono = { ok: true; saldo: number | null } | { ok: false; error: string; sinSesion?: true };

const confirmacionAbono = z.object({
  ...comun,
  borrador: z.object({
    cliente: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    monto: z.number().positive().max(ABONO_MAXIMO).nullable(),
    medio,
  }),
});

/** Guarda el abono y devuelve cómo quedó la deuda del cliente. */
export async function confirmarAbono(entrada: z.input<typeof confirmacionAbono>): Promise<ResultadoAbono> {
  const leido = confirmacionAbono.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa el monto de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs } = leido.data;
  const pedido = pedidoAbono(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa el monto de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: sinSesion("el abono"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar abonos." };

  const { error } = await supabase.from("abonos").insert(pedido);
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar el abono", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar abonos." };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs);
  return { ok: true, saldo: await leerSaldo(supabase, pedido.cliente_id) };
}
