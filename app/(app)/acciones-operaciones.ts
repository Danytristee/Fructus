"use server";

import { z } from "zod";

import { leerSaldo, leerStock, marcarComando, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { ABONO_MAXIMO, pedidoAbono } from "@/lib/voz/confirmar-abono-reglas";
import { CATEGORIAS, GASTO_MAXIMO, pedidoGasto } from "@/lib/voz/confirmar-gasto-reglas";
import { CAJAS_MAXIMO, pedidoMerma } from "@/lib/voz/confirmar-merma-reglas";

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

export type ResultadoMerma = { ok: true; stock: number | null } | { ok: false; error: string; sinSesion?: true };

const confirmacionMerma = z.object({
  ...comun,
  borrador: z.object({
    producto: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    cantidad: z.number().positive().max(CAJAS_MAXIMO),
    motivo: z.string().max(120).nullable(),
  }),
});

/** Saca del stock la fruta que se malogró y devuelve cuántas cajas quedan. */
export async function confirmarMerma(entrada: z.input<typeof confirmacionMerma>): Promise<ResultadoMerma> {
  const leido = confirmacionMerma.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa la fruta y las cajas de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs } = leido.data;
  const pedido = pedidoMerma(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa la fruta y las cajas de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: sinSesion("la merma"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar mermas." };

  const { error } = await supabase.from("movimientos_stock").insert(pedido);
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar la merma", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar mermas." };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs);
  return { ok: true, stock: await leerStock(supabase, pedido.producto_id) };
}

/** Cuántas cajas hay hoy de esa fruta, para mostrar cuántas quedan con esta merma. */
export async function stockDe(productoId: number): Promise<number | null> {
  const id = z.number().int().positive().safeParse(productoId);
  if (!id.success) return null;
  const s = await sesion();
  if (!s) return null;
  return leerStock(s.supabase, id.data);
}

export type ResultadoGasto = { ok: true } | { ok: false; error: string; sinSesion?: true };

const confirmacionGasto = z.object({
  ...comun,
  borrador: z.object({
    categoria: z.enum(CATEGORIAS),
    monto: z.number().positive().max(GASTO_MAXIMO).nullable(),
    descripcion: z.string().max(200).nullable(),
    medio,
  }),
});

/** Guarda el gasto (flete, alquiler, servicios, personal u otros). */
export async function confirmarGasto(entrada: z.input<typeof confirmacionGasto>): Promise<ResultadoGasto> {
  const leido = confirmacionGasto.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa el monto de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs } = leido.data;
  const pedido = pedidoGasto(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa el monto de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: sinSesion("el gasto"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar gastos." };

  const { error } = await supabase.from("gastos").insert(pedido);
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar el gasto", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar gastos." };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs);
  return { ok: true };
}
