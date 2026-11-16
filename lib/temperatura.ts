import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { diaDeLima } from "./formato";
import type { Database } from "./supabase/tipos-db";
import { diaAnterior, type TemperaturaDia } from "./temperatura-reglas";

/**
 * La temperatura de los últimos `dias` días de Lima, hoy incluido, del más viejo al más nuevo. Un día sin lectura no viene:
 * no se inventa. Lee v_temperatura_dia (la última lectura de cada día).
 */
export async function leerTemperaturas(supabase: SupabaseClient<Database>, ahora = new Date(), dias = 7): Promise<TemperaturaDia[]> {
  const hoy = diaDeLima(ahora);
  const { data, error } = await supabase
    .from("v_temperatura_dia")
    .select("dia, grados")
    .gte("dia", diaAnterior(hoy, dias - 1))
    .lte("dia", hoy)
    .order("dia");
  if (error) throw new Error(`No se pudo leer la temperatura (${error.code})`);
  return (data ?? []).flatMap((t) => (t.dia === null ? [] : [{ dia: t.dia, grados: Number(t.grados) }]));
}
