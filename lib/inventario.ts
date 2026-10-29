import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluarProducto, priorizarAlertas, resumirInventario, type ProductoInventario } from "./inventario-reglas";
import type { Database } from "./supabase/tipos-db";

const DIA_MS = 86_400_000;

/**
 * Lee lo que necesita el dashboard de inventario (stock, ventas de 7 días, entradas de 45 días) y lo evalúa con las reglas
 * de lib/inventario-reglas.ts. Lo usan Stock y el aviso de «Hoy». Cuatro consultas en paralelo.
 */
export async function leerInventario(supabase: SupabaseClient<Database>, hoy = new Date()) {
  const hace7 = new Date(hoy.getTime() - 7 * DIA_MS).toISOString();
  const hace45 = new Date(hoy.getTime() - 45 * DIA_MS).toISOString();
  const [productos, stock, vendidos, entradas] = await Promise.all([
    supabase.from("productos").select("id, nombre, variedad, precio_referencia").eq("activo", true).order("nombre"),
    supabase.from("v_stock").select("producto_id, stock"),
    supabase.from("venta_items").select("producto_id, cantidad, venta:ventas!inner(fecha, estado)").gte("venta.fecha", hace7).eq("venta.estado", "registrada"),
    supabase.from("movimientos_stock").select("producto_id, cantidad, fecha").eq("tipo", "entrada_compra").gte("fecha", hace45),
  ]);
  const error = productos.error ?? stock.error ?? vendidos.error ?? entradas.error;
  if (error) throw new Error(`No se pudo leer el inventario (${error.code})`);

  const stockDe = new Map((stock.data ?? []).map((s) => [s.producto_id, Number(s.stock ?? 0)]));
  const vendidoDe = new Map<number, number>();
  for (const v of vendidos.data ?? []) vendidoDe.set(v.producto_id, (vendidoDe.get(v.producto_id) ?? 0) + Number(v.cantidad));
  const entradasDe = new Map<number, { fecha: string; cantidad: number }[]>();
  for (const e of entradas.data ?? []) entradasDe.set(e.producto_id, [...(entradasDe.get(e.producto_id) ?? []), { fecha: e.fecha, cantidad: Number(e.cantidad) }]);

  const lista: ProductoInventario[] = (productos.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    variedad: p.variedad,
    stock: stockDe.get(p.id) ?? 0,
    vendido7: vendidoDe.get(p.id) ?? 0,
    entradas: entradasDe.get(p.id) ?? [],
    precioReferencia: p.precio_referencia === null ? null : Number(p.precio_referencia),
  }));
  const estados = lista.map((p) => evaluarProducto(p, hoy));
  return { productos: lista, estados, alertas: priorizarAlertas(estados), resumen: resumirInventario(lista, estados) };
}
