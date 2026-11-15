// Cuándo dejó de hablar, para enviar lo dictado sin un segundo toque (modo sin mantener, ADR-0018). Lógica pura: recibe el volumen
// del micrófono cada CUADRO_MS y dice cuándo terminó. No importa React ni el audio del navegador (eso es useGrabadora).
//
// Mide el volumen, no reconoce la voz: con un audífono que suprime el ruido, la voz de quien lo lleva queda muy por encima del
// fondo. Si el puesto suena tan fuerte como la voz, nunca «se calla» y se envía como antes: con un toque, o solo a los 55 s.

/** Cada cuánto se mide el volumen (ms). */
export const CUADRO_MS = 50;
/** Silencio después de hablar que basta para enviar. Una pausa para pensar el precio dura menos. */
export const SILENCIO_PARA_ENVIAR_MS = 1200;
/** Voz mínima antes de que el silencio cuente: un golpe o una tos sueltos no envían nada. */
export const VOZ_MINIMA_MS = 400;
/** Un cuadro es voz si suena al menos esto por encima del fondo (dB). */
export const SOBRE_EL_FONDO_DB = 12;
/** Por debajo de esto siempre es silencio (dB respecto del máximo del micrófono). */
const SILENCIO_ABSOLUTO_DB = -60;
/** Lo más bajo que se cuenta: el silencio digital es -∞. */
const PISO_DB = -100;
/** Cuánto sube el fondo por cuadro cuando no es voz: un motor que arranca despacio no se vuelve «voz» (2 dB por segundo). */
const SUBIDA_DEL_FONDO_DB = 0.1;

/** Lo que lleva oído: el ruido de fondo (null antes del primer cuadro), cuánta voz y cuánto silencio seguido. */
export type Oido = { fondo: number | null; vozMs: number; silencioMs: number };

export const OIDO_NUEVO: Oido = { fondo: null, vozMs: 0, silencioMs: 0 };

/** El volumen de un trozo de audio (muestras de -1 a 1), en dB respecto del máximo. Un trozo mudo da PISO_DB. */
export function nivelDb(muestras: ArrayLike<number>): number {
  if (muestras.length === 0) return PISO_DB;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i]! * muestras[i]!;
  const rms = Math.sqrt(suma / muestras.length);
  return rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB;
}

/**
 * Un cuadro más. `termino`: habló al menos VOZ_MINIMA_MS y después calló SILENCIO_PARA_ENVIAR_MS seguidos. Al terminar, lo oído se
 * reinicia (el fondo se conserva): si el dedo seguía encima y no se envió, la próxima vez que se calle vuelve a avisar.
 */
export function oir(o: Oido, nivel: number): { oido: Oido; termino: boolean } {
  const n = Math.max(PISO_DB, nivel);
  // El primer cuadro es el fondo: el micrófono recién arrancó y la persona todavía no habla («Te escucho» sale después).
  if (o.fondo === null) return { oido: { fondo: n, vozMs: 0, silencioMs: CUADRO_MS }, termino: false };
  const esVoz = n > SILENCIO_ABSOLUTO_DB && n >= o.fondo + SOBRE_EL_FONDO_DB;
  // El fondo baja enseguida y sube despacio, y no se mueve mientras habla: si no, la voz misma se volvería fondo.
  const fondo = esVoz ? o.fondo : n < o.fondo ? o.fondo + (n - o.fondo) / 2 : Math.min(n, o.fondo + SUBIDA_DEL_FONDO_DB);
  const vozMs = esVoz ? o.vozMs + CUADRO_MS : o.vozMs;
  const silencioMs = esVoz ? 0 : o.silencioMs + CUADRO_MS;
  if (vozMs >= VOZ_MINIMA_MS && silencioMs >= SILENCIO_PARA_ENVIAR_MS) return { oido: { fondo, vozMs: 0, silencioMs: 0 }, termino: true };
  return { oido: { fondo, vozMs, silencioMs }, termino: false };
}
