import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PartesProducto } from "../productos-reglas";
import type { Database } from "../supabase/tipos-db";
import type { EstimacionAceptada, VidaEstimada } from "../vida-estimada-reglas";
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

/** La estimación que rige para cada fruta, por id de producto. La fruta que no está sigue con la tabla. */
export async function leerVidaEstimada(supabase: Base): Promise<Map<number, VidaEstimada>> {
  const { data, error } = await supabase.from("v_vida_util").select("producto_id, dias, motivo, dia");
  if (error) throw new ErrorDeBase("v_vida_util", error.code);
  const vigentes = new Map<number, VidaEstimada>();
  for (const f of data) if (f.producto_id !== null && f.dias !== null && f.motivo !== null && f.dia !== null) vigentes.set(f.producto_id, { dias: Number(f.dias), motivo: f.motivo, dia: f.dia });
  return vigentes;
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
    leerYaEstimadas: async () => new Set((await leerVidaEstimada(db)).keys()),
    estimar: crearEstimadorConSonnet(),
    guardar: (dia, estimaciones) => guardar(db, dia, estimaciones),
  };
}
