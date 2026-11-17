import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { esHoraDeCierre, esMinutoDeCierre, type HoraDeCierre } from "./hora-cierre-reglas";
import type { Database } from "./supabase/tipos-db";

// La hora de cierre del puesto, en la base (ajustes_puesto, ADR-0023 y ADR-0024). La leen Ajustes y la fila del aviso (con la sesión de
// quien mira); la cambia solo fijar_hora_cierre, que revisa el rol. El reloj del aviso (aviso_del_dia) es solo del servidor.

type Base = SupabaseClient<Database>;

/** La hora guardada. Lanza si la base no responde: quien llama decide qué hacer. */
export async function leerHoraDeCierre(db: Base): Promise<HoraDeCierre> {
  const { data, error } = await db.from("ajustes_puesto").select("hora_cierre, minuto_cierre").single();
  if (error) throw new Error(`hora de cierre: la base no respondió (${error.code})`);
  if (!esHoraDeCierre(data.hora_cierre) || !esMinutoDeCierre(data.minuto_cierre)) throw new Error("hora de cierre: la base tiene una hora fuera de rango");
  return { hora: data.hora_cierre, minuto: data.minuto_cierre };
}

export type Reclamo = "reclamado" | "temprano" | "ya-avisado" | "ficha-invalida";
const RECLAMOS: readonly string[] = ["reclamado", "temprano", "ya-avisado", "ficha-invalida"];

/**
 * El cron reclama el día antes de avisar: solo una llamada por día pasa, venga del reloj de la base (con su ficha) o de los crons de
 * Vercel (sin ficha, ya autorizados con CRON_SECRET). Con la llave de servicio. Lanza si la base no responde.
 */
export async function reclamarElDia(db: Base, ficha: string | null): Promise<Reclamo> {
  const { data, error } = await db.rpc("reclamar_resumen_del_dia", ficha === null ? {} : { p_ficha: ficha });
  if (error) throw new Error(`aviso del día: la base no respondió al reclamar (${error.code})`);
  if (!RECLAMOS.includes(data)) throw new Error("aviso del día: la base contestó algo inesperado al reclamar");
  return data as Reclamo;
}

/** Si el aviso no pudo armarse, se suelta el día: el reloj de la base vuelve a intentar a los 5 minutos. Nunca lanza. */
export async function soltarElDia(db: Base): Promise<void> {
  const { error } = await db.rpc("soltar_resumen_del_dia");
  if (error) console.error("aviso del día: no se pudo soltar el día", { codigo: error.code });
}
