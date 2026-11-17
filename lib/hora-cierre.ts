import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { esHoraDeCierre } from "./hora-cierre-reglas";
import type { Database } from "./supabase/tipos-db";

// La hora de cierre del puesto, en la base (ajustes_puesto, ADR-0023). La leen el cron (con la llave de servicio), Ajustes y la fila del
// aviso (con la sesión de quien mira); la cambia solo fijar_hora_cierre, que revisa el rol.

/** La hora guardada. Lanza si la base no responde: quien llama decide qué hacer (el cron usa la de fábrica; la pantalla lo dice). */
export async function leerHoraDeCierre(db: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await db.from("ajustes_puesto").select("hora_cierre").single();
  if (error) throw new Error(`hora de cierre: la base no respondió (${error.code})`);
  if (!esHoraDeCierre(data.hora_cierre)) throw new Error("hora de cierre: la base tiene una hora fuera de rango");
  return data.hora_cierre;
}
