import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./supabase/tipos-db";
import type { FilaDeVenta } from "./ventas-reglas";

// PostgREST devuelve a lo sumo 1000 filas por pedido (la configuración de Supabase): se pide por páginas hasta tener todas.
const PAGINA = 1000;
const MAX_PAGINAS = 20;

/**
 * Las ventas desde una fecha, solo con lo necesario para sumarlas (fecha, total, condición y estado), SIN el tope de la lista del
 * historial. Los totales de «Hoy» y «7 días» salen de aquí: si salieran de la lista (que muestra las últimas 300), con más ventas
 * que eso el total saldría bajo sin avisar (principios 2 y 4). Con 20 a 60 ventas al día, son una o dos páginas.
 */
export async function leerFilasDeVentas(supabase: SupabaseClient<Database>, desde: string): Promise<FilaDeVenta[]> {
  const filas: FilaDeVenta[] = [];
  let hay = Infinity;
  for (let pagina = 0; pagina < MAX_PAGINAS && filas.length < hay; pagina++) {
    const { data, error, count } = await supabase
      .from("ventas")
      .select("fecha, total, condicion, estado", { count: "exact" })
      .gte("fecha", desde)
      .order("id")
      .range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);
    if (error) throw new Error(`No se pudo leer el resumen de ventas (${error.code})`);
    hay = count ?? 0;
    if (!data || data.length === 0) break;
    for (const f of data) filas.push({ fecha: f.fecha, total: Number(f.total), condicion: f.condicion, estado: f.estado });
  }
  if (filas.length < hay) throw new Error(`El resumen de ventas quedó incompleto (${filas.length} de ${hay})`);
  return filas;
}
