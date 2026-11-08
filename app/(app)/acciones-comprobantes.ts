"use server";

import { z } from "zod";

import type { ComprobanteVista } from "@/lib/comprobantes/comprobante-reglas";
import { emitirComprobanteDeVenta } from "@/lib/comprobantes/emitir";
import { sesion } from "@/lib/voz/accion-servidor";

// Emitir una boleta o una factura (A9). Lo hacen quienes registran ventas (el dueño, el administrador y el ayudante): el
// contador solo lee. El número se reserva en la base y es idempotente por venta, así que tocar dos veces, o que lo toquen dos
// personas a la vez, deja un solo comprobante.

// `ruc` solo cuenta para una factura a un cliente que todavía no tiene documento: se guarda en su ficha y se emite.
const entrada = z.object({ ventaId: z.number().int().positive(), tipo: z.enum(["boleta", "factura"]), ruc: z.string().max(40).optional() });

export type ResultadoEmitir = { ok: true; comprobante: ComprobanteVista; aviso?: string } | { ok: false; error: string; sinSesion?: true };

/** Emite el comprobante de la venta. Si ya tenía uno vigente, devuelve ese. */
export async function emitirComprobante(datos: z.input<typeof entrada>): Promise<ResultadoEmitir> {
  const leido = entrada.safeParse(datos);
  if (!leido.success) return { ok: false, error: "No se entendió qué comprobante emitir." };

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y emite el comprobante otra vez.", sinSesion: true };
  if (!s.permisos.registrar) return { ok: false, error: "Solo quien registra ventas puede emitir comprobantes." };

  return emitirComprobanteDeVenta({ supabase: s.supabase, ventaId: leido.data.ventaId, tipo: leido.data.tipo, ruc: leido.data.ruc });
}
