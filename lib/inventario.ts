import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { diaDeLima } from "./formato";
import { DIAS_DE_ENTRADAS, type Revision } from "./frescura-reglas";
import { evaluarProducto, priorizarAlertas, resumirInventario, type ProductoInventario } from "./inventario-reglas";
import type { Database } from "./supabase/tipos-db";
import { leerTemperaturas } from "./temperatura";
import { leerVidaEstimada } from "./vida-estimada/servidor";
import type { VidaEstimada } from "./vida-estimada-reglas";

const DIA_MS = 86_400_000;

/**
 * Lee lo que necesita el dashboard de inventario (stock, ventas de 7 días, entradas de compra o ajuste de 45 días, la temperatura de
 * esos días y cuánto aguanta cada fruta según la IA) y lo evalúa con las reglas de lib/inventario-reglas.ts. Lo usan Stock y el aviso
 * de «Hoy». Siete consultas en paralelo, contando las llegadas que alguien revisó hoy («Sigue buena»).
 * Las cajas que esas entradas no cubren salen como una llegada «de hace más de 45 días» (lib/frescura-reglas.ts).
 * Si la temperatura no se puede leer, el inventario igual sale: cada día cuenta como uno normal (principio 8). Si no se puede leer
 * lo que estimó la IA, también sale: cada fruta cuenta con la tabla. Y sin las revisiones de hoy, las llegadas pasadas vuelven a
 * pedir que las miren: avisar de más es el lado seguro.
 */
export async function leerInventario(supabase: SupabaseClient<Database>, hoy = new Date()) {
  const hace7 = new Date(hoy.getTime() - 7 * DIA_MS).toISOString();
  const hace45 = new Date(hoy.getTime() - DIAS_DE_ENTRADAS * DIA_MS).toISOString();
  const [productos, stock, vendidos, entradas, lecturas, estimadas, revisiones] = await Promise.all([
    supabase.from("productos").select("id, nombre, variedad, marca, seleccion, calibre, kg_por_caja, precio_referencia").eq("activo", true),
    supabase.from("v_stock").select("producto_id, stock"),
    supabase.from("venta_items").select("producto_id, cantidad, venta:ventas!inner(fecha, estado)").gte("venta.fecha", hace7).eq("venta.estado", "registrada"),
    // Las cajas entran por compra o por un ajuste a favor (un conteo, el stock inicial): las dos dicen cuándo llegó el lote.
    supabase.from("movimientos_stock").select("producto_id, cantidad, fecha, estado_llegada").in("tipo", ["entrada_compra", "ajuste"]).gt("cantidad", 0).gte("fecha", hace45),
    leerTemperaturas(supabase, hoy, DIAS_DE_ENTRADAS + 1).catch((e: unknown) => {
      console.error("inventario: no se pudo leer la temperatura", { error: e instanceof Error ? e.message : "desconocido" });
      return [];
    }),
    leerVidaEstimada(supabase).catch((e: unknown) => {
      console.error("inventario: no se pudo leer la vida estimada", { error: e instanceof Error ? e.name : "desconocido" });
      return new Map<number, VidaEstimada>();
    }),
    supabase.from("revisiones_frescura").select("producto_id, llegada_dia, llegada_estado, dia").eq("dia", diaDeLima(hoy)),
  ]);
  if (revisiones.error) console.error("inventario: no se pudieron leer las revisiones de hoy", { codigo: revisiones.error.code });
  const error = productos.error ?? stock.error ?? vendidos.error ?? entradas.error;
  if (error) throw new Error(`No se pudo leer el inventario (${error.code})`);

  const stockDe = new Map((stock.data ?? []).map((s) => [s.producto_id, Number(s.stock ?? 0)]));
  const vendidoDe = new Map<number, number>();
  for (const v of vendidos.data ?? []) vendidoDe.set(v.producto_id, (vendidoDe.get(v.producto_id) ?? 0) + Number(v.cantidad));
  const entradasDe = new Map<number, ProductoInventario["entradas"]>();
  for (const e of entradas.data ?? []) entradasDe.set(e.producto_id, [...(entradasDe.get(e.producto_id) ?? []), { fecha: e.fecha, cantidad: Number(e.cantidad), estado: e.estado_llegada }]);

  const revisionesDe = new Map<number, Revision[]>();
  for (const r of revisiones.data ?? []) revisionesDe.set(r.producto_id, [...(revisionesDe.get(r.producto_id) ?? []), { llegadaDia: r.llegada_dia, estado: r.llegada_estado, dia: r.dia }]);

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
    vidaEstimada: estimadas.get(p.id) ?? null,
    revisiones: revisionesDe.get(p.id) ?? [],
  }));
  const estados = lista.map((p) => evaluarProducto(p, hoy, lecturas));
  return { productos: lista, estados, alertas: priorizarAlertas(estados), resumen: resumirInventario(lista, estados), lecturas };
}
