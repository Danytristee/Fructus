"use server";

import { z } from "zod";

import { sinSesionAMano } from "@/lib/a-mano-reglas";
import { CLIENTE_YA_NO_ESTA, COMPRA_YA_NO_ESTA, conFecha, leerSaldo, leerStock, marcarComando, PRODUCTO_YA_NO_ESTA, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import type { Opcion } from "@/app/(app)/acciones-voz";
import { ABONO_MAXIMO, pedidoAbono } from "@/lib/voz/confirmar-abono-reglas";
import { pedidoCompra } from "@/lib/voz/confirmar-compra-reglas";
import { CATEGORIAS, DESCRIPCION_MAXIMO, GASTO_MAXIMO, pedidoGasto } from "@/lib/voz/confirmar-gasto-reglas";
import { CAJAS_MAXIMO, MOTIVO_MAXIMO, pedidoMerma } from "@/lib/voz/confirmar-merma-reglas";
import { PRECIO_MAXIMO } from "@/lib/voz/confirmar-venta-reglas";
import { buscarProveedores, costosSugeridos } from "@/lib/voz/resolver";

// Guardar lo que no es una venta: abonos, mermas, gastos y compras dictados (A6). Cada uno es idempotente por comando:
// un segundo toque, o un reintento tras una respuesta que no llegó, devuelve lo mismo y no guarda dos veces (el índice
// único de cada tabla manda; aquí se lee el choque como «ya estaba guardado»). La RLS es la seguridad.

const medio = z.enum(["efectivo", "yape", "plin", "transferencia"]);
const comun = {
  comandoId: z.number().int().positive(),
  corregido: z.boolean(),
  latenciaMs: z.number().int().min(0).max(120_000),
  /** La hora del toque, si viene de la cola sin conexión (ADR-0019). */
  fecha: z.iso.datetime({ offset: true }).optional(),
  /** Con un toque o diciendo «confirmo» después de oír la lectura (ADR-0020). */
  confirmadoPor: z.enum(["toque", "voz"]).default("toque"),
};
const YA_GUARDADO = "23505";

export type ResultadoAbono = { ok: true; saldo: number | null } | { ok: false; error: string; sinSesion?: true };

const confirmacionAbono = z.object({
  ...comun,
  /** Registrado a mano (A8): con la sesión vencida, la frase cambia porque a mano no queda nada esperando en «Hoy». */
  aMano: z.boolean().optional(),
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
  const { comandoId, borrador, corregido, latenciaMs, aMano, fecha, confirmadoPor } = leido.data;
  const pedido = pedidoAbono(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa el monto de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: aMano ? sinSesionAMano("el abono") : sinSesion("el abono"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar abonos." };

  const { error } = await supabase.from("abonos").insert(conFecha(pedido, fecha));
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar el abono", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar abonos." };
    if (error.code === "23503") return { ok: false, error: CLIENTE_YA_NO_ESTA };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs, confirmadoPor);
  return { ok: true, saldo: await leerSaldo(supabase, pedido.cliente_id) };
}

export type ResultadoMerma = { ok: true; stock: number | null } | { ok: false; error: string; sinSesion?: true };

const confirmacionMerma = z.object({
  ...comun,
  /** Registrada a mano (A8): con la sesión vencida, la frase cambia porque a mano no queda nada esperando en «Hoy». */
  aMano: z.boolean().optional(),
  borrador: z.object({
    producto: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    cantidad: z.number().positive().max(CAJAS_MAXIMO),
    motivo: z.string().max(MOTIVO_MAXIMO).nullable(),
  }),
});

/** Saca del stock la fruta que se malogró y devuelve cuántas cajas quedan. */
export async function confirmarMerma(entrada: z.input<typeof confirmacionMerma>): Promise<ResultadoMerma> {
  const leido = confirmacionMerma.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa la fruta y las cajas de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs, aMano, fecha, confirmadoPor } = leido.data;
  const pedido = pedidoMerma(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa la fruta y las cajas de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: aMano ? sinSesionAMano("la merma") : sinSesion("la merma"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar mermas." };

  const { error } = await supabase.from("movimientos_stock").insert(conFecha(pedido, fecha));
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar la merma", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar mermas." };
    if (error.code === "23503") return { ok: false, error: PRODUCTO_YA_NO_ESTA };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs, confirmadoPor);
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
    descripcion: z.string().max(DESCRIPCION_MAXIMO).nullable(),
    medio,
  }),
});

/** Guarda el gasto (flete, alquiler, servicios, personal u otros). */
export async function confirmarGasto(entrada: z.input<typeof confirmacionGasto>): Promise<ResultadoGasto> {
  const leido = confirmacionGasto.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa el monto de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs, fecha, confirmadoPor } = leido.data;
  const pedido = pedidoGasto(borrador, comandoId);
  if (!pedido) return { ok: false, error: "Revisa el monto de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: sinSesion("el gasto"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar gastos." };

  const { error } = await supabase.from("gastos").insert(conFecha(pedido, fecha));
  if (error && error.code !== YA_GUARDADO) {
    console.error("voz: no se pudo registrar el gasto", { comandoId, codigo: error.code });
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar gastos." };
    return { ok: false, error: SIN_SENAL };
  }

  await marcarComando(supabase, comandoId, corregido, latenciaMs, confirmadoPor);
  return { ok: true };
}

export type ResultadoCompra = { ok: true; compraId: number } | { ok: false; error: string; sinSesion?: true };

const confirmacionCompra = z.object({
  ...comun,
  /** Registrada a mano (A8): con la sesión vencida, la frase cambia porque a mano no queda nada esperando en «Hoy». */
  aMano: z.boolean().optional(),
  borrador: z.object({
    proveedor: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
    items: z
      .array(
        z.object({
          productoId: z.number().int().positive().nullable(),
          producto: z.string(),
          cantidad: z.number().positive().max(CAJAS_MAXIMO),
          precio: z.number().positive().max(PRECIO_MAXIMO).nullable(),
          sugerido: z.boolean(),
        }),
      )
      .min(1)
      .max(30),
    condicion: z.enum(["contado", "credito"]).nullable(),
    medio: medio.nullable(),
  }),
});

/** Guarda la compra: entra el stock y, si se debe, queda la deuda con el proveedor. Idempotente por comando (registrar_compra). */
export async function confirmarCompra(entrada: z.input<typeof confirmacionCompra>): Promise<ResultadoCompra> {
  const leido = confirmacionCompra.safeParse(entrada);
  if (!leido.success) return { ok: false, error: "Revisa el costo y las cajas de la tarjeta." };
  const { comandoId, borrador, corregido, latenciaMs, aMano, fecha, confirmadoPor } = leido.data;
  const pedido = pedidoCompra(borrador, comandoId, corregido);
  if (!pedido) return { ok: false, error: "Revisa el costo y las cajas de la tarjeta." };

  const s = await sesion();
  if (!s) return { ok: false, error: aMano ? sinSesionAMano("la compra") : sinSesion("la compra"), sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar compras." };

  const { data: compraId, error } = await supabase.rpc("registrar_compra", { p: { ...conFecha(pedido, fecha), confirmado_por: confirmadoPor } });
  if (error || compraId === null) {
    console.error("voz: no se pudo registrar la compra", { comandoId, codigo: error?.code });
    if (error?.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar compras." };
    if (error?.code === "23514") return { ok: false, error: "Al crédito tienes que elegir a quién le debes." };
    if (error?.code === "23503") return { ok: false, error: COMPRA_YA_NO_ESTA };
    if (error?.code === "23502") return { ok: false, error: "Falta decir si la pagaste o la debes." };
    if (error?.message.includes("dos decimales")) return { ok: false, error: "El costo y las cajas van con dos decimales como máximo." };
    return { ok: false, error: SIN_SENAL };
  }

  // La latencia va aparte (registrar_compra ya marcó el comando): si no se guarda, la compra igual vale.
  const { error: errorLatencia } = await supabase.from("comandos_voz").update({ latencia_ms: latenciaMs }).eq("id", comandoId);
  if (errorLatencia) console.error("voz: no se pudo guardar la latencia", { comandoId, codigo: errorLatencia.code });
  return { ok: true, compraId };
}

const busqueda = z.string().trim().min(1).max(60);

/** Proveedores por nombre o apodo, para corregir quién trajo la fruta. */
export async function buscarProveedoresVoz(q: string): Promise<Opcion[] | null> {
  const texto = busqueda.safeParse(q);
  if (!texto.success) return [];
  const s = await sesion();
  if (!s) return null;
  try {
    return (await buscarProveedores(s.supabase, texto.data)).map((p) => ({ id: p.id, nombre: p.nombre, detalle: null }));
  } catch (e) {
    console.error("voz: no se pudo buscar proveedores", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  }
}

/** El costo sugerido de una fruta: lo que se pagó por caja en su última compra. */
export async function sugerirCosto(productoId: number): Promise<number | null> {
  const id = z.number().int().positive().safeParse(productoId);
  if (!id.success) return null;
  const s = await sesion();
  if (!s) return null;
  try {
    return (await costosSugeridos(s.supabase, [id.data]))[0] ?? null;
  } catch (e) {
    console.error("voz: no se pudo sugerir el costo", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  }
}
