// La hora de cierre del puesto: a qué hora y minuto sale el aviso del día (ADR-0023, ADR-0024). Lógica pura: no importa React ni Supabase.
//
// El problema: el aviso salía siempre a las 7 p. m. Un puesto que cierra a las 3 p. m. recibía su resumen cuatro horas tarde; uno que
// cierra a las 9 p. m., con el día a medias. El dueño la elige en Ajustes con una rueda de horas y minutos.
// Cómo se cumple el minuto sin pagar Vercel Pro: el reloj lo lleva la base (pg_cron cada minuto, ADR-0024). Los crons de Vercel, uno por
// cada hora que se puede elegir, quedan de respaldo: si la base no llama, el aviso sale igual, hasta una hora tarde.
// Mal hecho: comparar contra la hora UTC (el aviso saldría 5 horas antes), o dejar elegir minutos que nadie cumple.
import { formatearHora } from "./formato";

export type HoraDeCierre = { hora: number; minuto: number };

/**
 * Las horas que se pueden elegir, de Lima: de las 8 a. m. a las 11 p. m. Antes de las 8 el día recién empieza y el resumen saldría vacío;
 * después de medianoche ya sería el resumen de otro día. vercel.json tiene un cron por cada una (lo vigila hora-cierre-reglas.test.ts).
 */
export const HORAS_DE_CIERRE: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 8);

/** Los minutos, de 5 en 5: nadie cierra a las 4:37, y la rueda gira 12 posiciones en vez de 60. La base exige lo mismo. */
export const MINUTOS_DE_CIERRE: readonly number[] = Array.from({ length: 12 }, (_, i) => i * 5);

/** La de siempre: las 7 p. m., el puesto ya cerró y la gente que vende de mañana ya descansa. La base nace con esta. */
export const HORA_DE_CIERRE_DE_FABRICA: HoraDeCierre = { hora: 19, minuto: 0 };

export function esHoraDeCierre(hora: number): boolean {
  return HORAS_DE_CIERRE.includes(hora);
}

export function esMinutoDeCierre(minuto: number): boolean {
  return MINUTOS_DE_CIERRE.includes(minuto);
}

/** Lima es UTC−5 todo el año: no tiene horario de verano. */
const DESFASE_LIMA = 5;

/** La hora de Lima (0 a 23) de un instante. */
export function horaDeLima(ahora: Date): number {
  return (ahora.getUTCHours() + 24 - DESFASE_LIMA) % 24;
}

/** El cron de Vercel (que va en UTC) para una hora de Lima: las 7 p. m. son «0 0 * * *». */
export function cronDeLaHora(hora: number): string {
  return `0 ${(hora + DESFASE_LIMA) % 24} * * *`;
}

/** La hora de 1 a 12, como se dice en el puesto (la rueda muestra esta). */
export function horaDeReloj(hora: number): number {
  return hora % 12 === 0 ? 12 : hora % 12;
}

/** «a. m.», «p. m.», o «m.» para el mediodía en punto (como en formatearHora). */
export function periodoDe({ hora, minuto }: HoraDeCierre): string {
  if (hora === 12 && minuto === 0) return "m.";
  return hora < 12 ? "a. m." : "p. m.";
}

/**
 * «4 p. m.», «4:30 p. m.», «12 m.», «12:30 p. m.». En punto, sin «:00», como se dice. Con espacios duros: «p. m.» nunca se parte en dos
 * renglones (pasó a 412 px en el aviso de «Listo»).
 */
export function formatearHoraDeCierre(h: HoraDeCierre): string {
  const texto = h.minuto === 0 ? formatearHora(h.hora) : `${horaDeReloj(h.hora)}:${String(h.minuto).padStart(2, "0")} ${periodoDe(h)}`;
  return texto.replace(/ /g, "\u00a0");
}

/** Cómo se dice en una frase: «a las 4:30 p. m.», «a la 1 p. m.». */
export function textoDeLaHora(h: HoraDeCierre): string {
  return `a ${horaDeReloj(h.hora) === 1 ? "la" : "las"} ${formatearHoraDeCierre(h)}`;
}

/**
 * Al cambiarla, ¿el aviso de hoy sale a la hora nueva o recién mañana? Si ya pasó, o es este mismo minuto, «mañana»: el reloj pudo haber
 * llamado ya. (Si el aviso de hoy ya salió a la hora vieja, la base no lo manda otra vez: se reclama una sola vez por día.)
 */
export function desdeCuandoRige(h: HoraDeCierre, ahora: Date): "hoy" | "mañana" {
  const ahoraEnMinutos = horaDeLima(ahora) * 60 + ahora.getUTCMinutes();
  return h.hora * 60 + h.minuto > ahoraEnMinutos ? "hoy" : "mañana";
}
