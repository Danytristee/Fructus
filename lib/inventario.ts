import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluarProducto, priorizarAlertas, resumirInventario, type ProductoInventario } from "./inventario-reglas";
import type { Database } from "./supabase/tipos-db";
import { leerTemperaturas } from "./temperatura";

const DIA_MS = 86_400_000;

/**
 * Lee lo que necesita el dashboard de inventario (stock, ventas de 7 días, entradas de compra o ajuste de 45 días y la temperatura de
 * esos días) y lo evalúa con las reglas de lib/inventario-reglas.ts. Lo usan Stock y el aviso de «Hoy». Cinco consultas en paralelo.
 * Si la temperatura no se puede leer, el inventario igual sale: cada día cuenta como uno normal (principio 8).
 */
export async function leerInventario(supabase: SupabaseClient<Database>, hoy = new Date()) {
  const hace7 = new Date(hoy.getTime() - 7 * DIA_MS).toISOString();
  const hace45 = new Date(hoy.getTime() - 45 * DIA_MS).toISOString();
  const [productos, stock, vendidos, entradas, lecturas] = await Promise.all([
    supabase.from("productos").select("id, nombre, variedad, marca, seleccion, calibre, kg_por_caja, precio_referencia").eq("activo", true),
    supabase.from("v_stock").select("producto_id, stock"),
    supabase.from("venta_items").select("producto_id, cantidad, venta:ventas!inner(fecha, estado)").gte("venta.fecha", hace7).eq("venta.estado", "registrada"),
    // Las cajas entran por compra o por un ajuste a favor (un conteo, el stock inicial): las dos dicen cuándo llegó el lote.
    supabase.from("movimientos_stock").select("producto_id, cantidad, fecha").in("tipo", ["entrada_compra", "ajuste"]).gt("cantidad", 0).gte("fecha", hace45),
    leerTemperaturas(supabase, hoy, 46).catch((e: unknown) => {
      console.error("inventario: no se pudo leer la temperatura", { error: e instanceof Error ? e.message : "desconocido" });
      return [];
    }),
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
    marca: p.marca,
    seleccion: p.seleccion,
    calibre: p.calibre,
    kgPorCaja: p.kg_por_caja === null ? null : Number(p.kg_por_caja),
    stock: stockDe.get(p.id) ?? 0,
    vendido7: vendidoDe.get(p.id) ?? 0,
    entradas: entradasDe.get(p.id) ?? [],
    precioReferencia: p.precio_referencia === null ? null : Number(p.precio_referencia),
  }));
  const estados = lista.map((p) => evaluarProducto(p, hoy, lecturas));
  return { productos: lista, estados, alertas: priorizarAlertas(estados), resumen: resumirInventario(lista, estados), lecturas };
}
