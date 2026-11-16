"use server";

import { z } from "zod";

import { marcarComando, sesion } from "@/lib/voz/accion-servidor";
import type { Respuesta } from "@/lib/voz/consultas-reglas";
import { responderConsulta as responder } from "@/lib/voz/consultas";

// Responder lo que se preguntó por voz cuando la respuesta no llegó con la tarjeta: porque hubo que elegir el cliente o
// la fruta, o porque la lectura falló en /api/voz. Solo lee; el comando queda confirmado al responder.

const pedido = z.object({
  comandoId: z.number().int().positive(),
  consulta: z.enum(["ventas_hoy", "quien_me_debe", "deuda_cliente", "stock", "stock_producto", "gastos_hoy", "resumen_dia", "que_sale_hoy"]),
  clienteId: z.number().int().positive().nullable(),
  productoId: z.number().int().positive().nullable(),
  latenciaMs: z.number().int().min(0).max(120_000),
});

export type ResultadoConsulta = { ok: true; respuesta: Respuesta | null } | { ok: false; error: string };

export async function responderConsulta(entrada: z.input<typeof pedido>): Promise<ResultadoConsulta> {
  const leido = pedido.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "No entendí la pregunta. Dímela otra vez." };
  const { comandoId, latenciaMs, ...p } = leido.data;
  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y pregúntame otra vez." };
  try {
    const respuesta = await responder(s.supabase, p);
    if (respuesta) await marcarComando(s.supabase, comandoId, false, latenciaMs);
    return { ok: true, respuesta };
  } catch (e) {
    console.error("voz: no se pudo responder la consulta", { comandoId, error: e instanceof Error ? e.message : "desconocido" });
    return { ok: false, error: "No pude leer tu cuaderno. Revisa tu señal e inténtalo otra vez." };
  }
}
