import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { diaDeLima } from "../formato";
import { DIAS_DE_ENTRADAS } from "../frescura-reglas";
import type { PartesProducto } from "../productos-reglas";
import type { Database } from "../supabase/tipos-db";
import { leerTemperaturas } from "../temperatura";
import { diaAnterior } from "../temperatura-reglas";
import { DIAS_DE_EVIDENCIA, type EstimacionAceptada, type Hechos, type VidaVigente } from "../vida-estimada-reglas";
import type { Dependencias } from "./estimar-del-dia";
import { crearEstimadorConSonnet, MODELO_DE_FRESCURA } from "./sonnet";

// Lo que une la estimación de vida útil con la base: leer la que rige (cualquier sesión) y guardar la de la noche (solo el
// servidor, con la llave de servicio: la tabla no deja escribir a nadie más).

type Base = SupabaseClient<Database>;

class ErrorDeBase extends Error {
  constructor(tabla: string, codigo: string) {
    super(`vida estimada: la base no respondió (${tabla}, ${codigo})`);
    this.name = `base:${tabla}:${codigo}`;
  }
}

/** La estimación que rige para cada fruta, por id de producto, con el momento en que se guardó. La fruta que no está sigue con la tabla. */
export async function leerVidaEstimada(supabase: Base): Promise<Map<number, VidaVigente>> {
  const { data, error } = await supabase.from("v_vida_util").select("producto_id, dias, motivo, dia, creado_en");
  if (error) throw new ErrorDeBase("v_vida_util", error.code);
  const vigentes = new Map<number, VidaVigente>();
  for (const f of data) {
    if (f.producto_id === null || f.dias === null || f.motivo === null || f.dia === null || f.creado_en === null) continue;
    vigentes.set(f.producto_id, { dias: Number(f.dias), motivo: f.motivo, dia: f.dia, creadoEn: f.creado_en });
  }
  return vigentes;
}

const DIA_MS = 86_400_000;

/**
 * Lo que pasó en el puesto en los últimos 30 días, para armar la evidencia: las mermas (con el stock que había justo antes), los
 * «Sigue buena», y, de las frutas con merma, sus llegadas de 45 días más atrás, que es de donde pudo salir lo que se malogró.
 * Más las temperaturas de todo ese tramo. Un puesto de 60 ventas al día no llega a los topes de filas; si llegara, se queda
 * con lo más reciente.
 */
async function leerHechos(db: Base, ahora: Date): Promise<Hechos> {
  const desde = diaAnterior(diaDeLima(ahora), DIAS_DE_EVIDENCIA);
  const [mermas, revisiones, lecturas] = await Promise.all([
    db.from("v_mermas_con_stock").select("producto_id, fecha, cajas, stock_antes").gte("fecha", `${desde}T00:00:00-05:00`).order("fecha", { ascending: false }).limit(500),
    db.from("revisiones_frescura").select("producto_id, llegada_dia, llegada_estado, dia, creado_en").gte("dia", desde).order("creado_en", { ascending: false }).limit(500),
    leerTemperaturas(db, ahora, DIAS_DE_EVIDENCIA + DIAS_DE_ENTRADAS + 1),
  ]);
  if (mermas.error) throw new ErrorDeBase("v_mermas_con_stock", mermas.error.code);
  if (revisiones.error) throw new ErrorDeBase("revisiones_frescura", revisiones.error.code);

  const conMerma = [...new Set(mermas.data.flatMap((m) => (m.producto_id === null ? [] : [m.producto_id])))];
  const entradas =
    conMerma.length === 0
      ? { data: [], error: null }
      : await db
          .from("movimientos_stock")
          .select("producto_id, cantidad, fecha, estado_llegada")
          .in("tipo", ["entrada_compra", "ajuste"])
          .gt("cantidad", 0)
          .in("producto_id", conMerma)
          .gte("fecha", new Date(ahora.getTime() - (DIAS_DE_EVIDENCIA + DIAS_DE_ENTRADAS) * DIA_MS).toISOString())
          .order("fecha", { ascending: false })
          .limit(1000);
  if (entradas.error) throw new ErrorDeBase("movimientos_stock", entradas.error.code);

  return {
    mermas: mermas.data.flatMap((m) => (m.producto_id === null || m.fecha === null ? [] : [{ productoId: m.producto_id, fecha: m.fecha, cajas: Number(m.cajas ?? 0), stockAntes: Number(m.stock_antes ?? 0) }])),
    revisiones: revisiones.data.map((r) => ({ productoId: r.producto_id, llegadaDia: r.llegada_dia, estado: r.llegada_estado, dia: r.dia, creadoEn: r.creado_en })),
    entradas: entradas.data.map((e) => ({ productoId: e.producto_id, fecha: e.fecha, cantidad: Number(e.cantidad), estado: e.estado_llegada })),
    lecturas,
  };
}

async function leerFrutas(db: Base): Promise<(PartesProducto & { id: number; stock: number })[]> {
  const [productos, stock] = await Promise.all([
    db.from("productos").select("id, nombre, variedad, marca, seleccion, calibre, kg_por_caja").eq("activo", true).order("id"),
    db.from("v_stock").select("producto_id, stock"),
  ]);
  if (productos.error) throw new ErrorDeBase("productos", productos.error.code);
  if (stock.error) throw new ErrorDeBase("v_stock", stock.error.code);
  const stockDe = new Map(stock.data.map((s) => [s.producto_id, Number(s.stock ?? 0)]));
  return productos.data.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    variedad: p.variedad,
    marca: p.marca,
    seleccion: p.seleccion,
    calibre: p.calibre,
    kgPorCaja: p.kg_por_caja === null ? null : Number(p.kg_por_caja),
    stock: stockDe.get(p.id) ?? 0,
  }));
}

/** Guarda la estimación de la noche. Una por fruta y por día: si el envío se repite, la segunda vez no cambia nada. */
async function guardar(db: Base, dia: string, estimaciones: EstimacionAceptada[]): Promise<void> {
  const filas = estimaciones.map((e) => ({ producto_id: e.productoId, dia, dias: e.dias, motivo: e.motivo, modelo: MODELO_DE_FRESCURA }));
  const { error } = await db.from("vida_util_estimada").upsert(filas, { onConflict: "producto_id,dia", ignoreDuplicates: true });
  if (error) throw new ErrorDeBase("vida_util_estimada", error.code);
}

/** Lo que necesita la estimación de la noche, cableado a la base (con la llave de servicio) y al modelo. */
export function dependenciasDeLaEstimacion(db: Base): Dependencias {
  return {
    leerFrutas: () => leerFrutas(db),
    leerVigentes: () => leerVidaEstimada(db),
    leerHechos: (ahora) => leerHechos(db, ahora),
    estimar: crearEstimadorConSonnet(),
    guardar: (dia, estimaciones) => guardar(db, dia, estimaciones),
  };
}
