// La hora de cierre del puesto: a qué hora sale el aviso del día (ADR-0023). Lógica pura: no importa React ni Supabase.
//
// El problema: el aviso salía siempre a las 7 p. m., escrito en vercel.json. Un puesto que cierra a las 3 p. m. recibía su resumen cuatro
// horas tarde, cuando ya no le servía; uno que cierra a las 9 p. m. lo recibía con el día a medias. La hora la elige el dueño en Ajustes.
// Cómo se logra sin pagar Vercel Pro: Hobby deja 100 crons por proyecto, cada uno una vez al día. Hay uno por cada hora que se puede
// elegir, todos a la misma ruta; cada uno mira la hora guardada y solo el de esa hora avisa. Los demás pasan sin hacer nada.
// Mal hecho: un cron por hora con «0 * * * *» (Hobby no lo deja desplegar), o comparar contra la hora UTC (el aviso saldría 5 horas antes).
import { formatearHora } from "./formato";

/**
 * Las horas que se pueden elegir, de Lima: de las 8 a. m. a las 11 p. m. Antes de las 8 el día recién empieza y el resumen saldría vacío;
 * después de medianoche ya sería el resumen de otro día. vercel.json tiene un cron por cada una (lo vigila hora-cierre-reglas.test.ts).
 */
export const HORAS_DE_CIERRE: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 8);

/** La de siempre: las 7 p. m., el puesto ya cerró y la gente que vende de mañana ya descansa. La base nace con esta. */
export const HORA_DE_CIERRE_DE_FABRICA = 19;

export function esHoraDeCierre(hora: number): boolean {
  return HORAS_DE_CIERRE.includes(hora);
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

/**
 * ¿Este cron es el de la hora elegida? En Hobby el cron de una hora llega en cualquier minuto de esa hora (no a la hora en punto), así
 * que basta comparar la hora de Lima del momento en que llegó.
 */
export function tocaAvisar(horaElegida: number, ahora: Date): boolean {
  return horaDeLima(ahora) === horaElegida;
}

/** Cómo se dice en pantalla: «como a las 7 p. m.», «como a la 1 p. m.». El «como» porque en Hobby no llega a la hora exacta. */
export function textoDeLaHora(hora: number): string {
  return `como a ${hora % 12 === 1 ? "la" : "las"} ${formatearHora(hora)}`;
}

/**
 * Al cambiarla, ¿el aviso de hoy sale a la hora nueva o recién mañana? Si la hora nueva es esta misma, el cron pudo haber corrido ya en
 * este rato: se dice «mañana» para no prometer un aviso que quizá no llega. (Si el aviso de hoy ya había salido a la hora vieja y la nueva
 * es más tarde, vuelve a salir con las cifras al día y reemplaza al anterior en el teléfono: misma etiqueta del día.)
 */
export function desdeCuandoRige(hora: number, ahora: Date): "hoy" | "mañana" {
  return hora > horaDeLima(ahora) ? "hoy" : "mañana";
}
