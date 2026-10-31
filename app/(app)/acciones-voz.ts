"use server";

import { z } from "zod";

import { leerSaldo, sesion, SIN_SENAL, sinSesion } from "@/lib/voz/accion-servidor";
import { PRECIO_MAXIMO, pedidoVenta } from "@/lib/voz/confirmar-venta-reglas";
import { preciosSugeridos } from "@/lib/voz/resolver";

// Lo que la tarjeta de voz le pide al servidor: guardar la venta, descartar el comando, buscar quién o qué fue, el precio
// sugerido y la deuda del cliente. En «Hoy» el navegador no carga supabase-js (CLAUDE.md, regla 9): todo pasa por aquí.
// La RLS es la seguridad; aquí solo se valida la forma y se traducen los errores a lenguaje de puesto.

const SIN_SESION = sinSesion("la venta");
const REVISA = "Revisa el precio y las cajas de la tarjeta.";

const nombreProducto = (p: { nombre: string; variedad: string | null }) => [p.nombre, p.variedad].filter(Boolean).join(" ");

const borrador = z.object({
  cliente: z.object({ id: z.number().int().positive(), nombre: z.string() }).nullable(),
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive().nullable(),
        producto: z.string(),
        cantidad: z.number().positive().max(10_000),
        precio: z.number().positive().max(PRECIO_MAXIMO).nullable(),
        sugerido: z.boolean(),
      }),
    )
    .min(1)
    .max(30),
  descuento: z.number().min(0),
  condicion: z.enum(["contado", "credito"]).nullable(),
  medio: z.enum(["efectivo", "yape", "plin", "transferencia"]).nullable(),
});

const confirmacion = z.object({
  comandoId: z.number().int().positive(),
  borrador,
  corregido: z.boolean(),
  latenciaMs: z.number().int().min(0).max(120_000),
});

export type ResultadoConfirmar = { ok: true; ventaId: number; saldo: number | null } | { ok: false; error: string; sinSesion?: true };

/** Guarda la venta. Idempotente por comando (registrar_venta): un segundo toque devuelve la misma venta. */
export async function confirmarVenta(entrada: z.input<typeof confirmacion>): Promise<ResultadoConfirmar> {
  const leido = confirmacion.safeParse(entrada);
  if (!leido.success) return { ok: false, error: REVISA };
  const { comandoId, borrador: b, corregido, latenciaMs } = leido.data;
  const pedido = pedidoVenta(b, comandoId, corregido);
  if (!pedido) return { ok: false, error: REVISA };

  const s = await sesion();
  if (!s) return { ok: false, error: SIN_SESION, sinSesion: true };
  const { supabase, permisos } = s;
  if (!permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar ventas." };

  const { data: ventaId, error } = await supabase.rpc("registrar_venta", { p: pedido });
  if (error || ventaId === null) {
    console.error("voz: no se pudo registrar la venta", { comandoId, codigo: error?.code });
    if (error?.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar ventas." };
    if (error?.code === "23514") return { ok: false, error: "Al crédito tienes que elegir a quién le fiaste." };
    if (error?.message.includes("dos decimales")) return { ok: false, error: "El precio y las cajas van con dos decimales como máximo." };
    return { ok: false, error: SIN_SENAL };
  }

  // De soltar el botón a ver la tarjeta, medido en el celular (CLAUDE.md, regla 9). Si no se guarda, la venta igual vale.
  const { error: errorLatencia } = await supabase.from("comandos_voz").update({ latencia_ms: latenciaMs }).eq("id", comandoId);
  if (errorLatencia) console.error("voz: no se pudo guardar la latencia", { comandoId, codigo: errorLatencia.code });

  const saldo = pedido.cliente_id === null ? null : await leerSaldo(supabase, pedido.cliente_id);

  // Sin revalidatePath: rearmar «Hoy» dentro de esta respuesta demoraba el sello 2 a 5 s. El celular refresca «Hoy» por
  // detrás (router.refresh) mientras el sello se anima.
  return { ok: true, ventaId, saldo };
}

/** La persona cerró la tarjeta sin guardar: el comando queda como descartado (solo si seguía pendiente). */
export async function descartarComando(comandoId: number, latenciaMs: number): Promise<void> {
  const id = z.number().int().positive().safeParse(comandoId);
  if (!id.success) return;
  const s = await sesion();
  if (!s) return; // sin sesión el comando queda «pendiente»: no guarda nada y solo cuenta distinto en la precisión
  const { error } = await s.supabase
    .from("comandos_voz")
    .update({ resultado: "descartado", latencia_ms: Math.max(0, Math.round(latenciaMs)) })
    .eq("id", id.data)
    .eq("resultado", "pendiente");
  if (error) console.error("voz: no se pudo descartar el comando", { comandoId: id.data, codigo: error.code });
}

export type Opcion = { id: number; nombre: string; detalle: string | null };

const busqueda = z.string().trim().min(1).max(60);

/** Clientes por nombre o apodo (pg_trgm), para corregir a quién fue. */
export async function buscarClientes(q: string): Promise<Opcion[] | null> {
  const texto = busqueda.safeParse(q);
  if (!texto.success) return [];
  const s = await sesion();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("buscar_clientes", { q: texto.data, limite: 6 });
  if (error) {
    console.error("voz: no se pudo buscar clientes", { codigo: error.code });
    return null;
  }
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.alias?.[0] ? `«${c.alias[0]}»` : null }));
}

/** Frutas por nombre o variedad, para corregir qué fue. */
export async function buscarProductos(q: string): Promise<Opcion[] | null> {
  const texto = busqueda.safeParse(q);
  if (!texto.success) return [];
  const s = await sesion();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("buscar_productos", { q: texto.data, limite: 6 });
  if (error) {
    console.error("voz: no se pudo buscar productos", { codigo: error.code });
    return null;
  }
  return (data ?? []).map((p) => ({ id: p.id, nombre: nombreProducto(p), detalle: null }));
}

/** El precio sugerido de cada fruta para ese cliente: el último que se le cobró, o el de referencia. */
export async function sugerirPrecios(clienteId: number | null, productos: number[]): Promise<(number | null)[] | null> {
  const ids = z.array(z.number().int().positive()).max(30).safeParse(productos);
  const cliente = z.number().int().positive().nullable().safeParse(clienteId);
  if (!ids.success || !cliente.success) return null;
  const s = await sesion();
  if (!s) return null;
  try {
    return await preciosSugeridos(s.supabase, cliente.data, ids.data);
  } catch (e) {
    console.error("voz: no se pudo sugerir el precio", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  }
}

/** Cuánto debe hoy el cliente, para mostrar cómo queda con esta venta o este abono. */
export async function saldoDe(clienteId: number): Promise<number | null> {
  const id = z.number().int().positive().safeParse(clienteId);
  if (!id.success) return null;
  const s = await sesion();
  if (!s) return null;
  return leerSaldo(s.supabase, id.data);
}
