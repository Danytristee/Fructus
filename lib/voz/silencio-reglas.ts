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

/**
 * Lo que lleva oído: el ruido de fondo (null antes del primer cuadro) y el volumen de cada cuadro desde que empezó a escuchar (o desde la
 * última vez que terminó). Se guardan para volver a mirarlos contra el fondo de ahora: ver `oir`.
 */
export type Oido = { fondo: number | null; niveles: number[] };

export const OIDO_NUEVO: Oido = { fondo: null, niveles: [] };

/** Cuántos cuadros se recuerdan: 20 s. Para decidir si se calló no hace falta mirar más atrás. */
const CUADROS_RECORDADOS = 400;

const esVoz = (nivel: number, fondo: number) => nivel > SILENCIO_ABSOLUTO_DB && nivel >= fondo + SOBRE_EL_FONDO_DB;

/** El volumen de un trozo de audio (muestras de -1 a 1), en dB respecto del máximo. Un trozo mudo da PISO_DB. */
export function nivelDb(muestras: ArrayLike<number>): number {
  if (muestras.length === 0) return PISO_DB;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i]! * muestras[i]!;
  const rms = Math.sqrt(suma / muestras.length);
  return rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB;
}

/**
 * Un cuadro más. `termino`: habló al menos VOZ_MINIMA_MS y después calló `silencioMs` seguidos (un dictado, SILENCIO_PARA_ENVIAR_MS;
 * una respuesta de una palabra, menos). Al terminar, lo oído se reinicia (el fondo se conserva): si el dedo seguía encima y no se
 * envió, la próxima vez que se calle vuelve a avisar. `vozMs`: cuánta voz lleva, para saber si ya empezó a hablar.
 *
 * Lo oído se vuelve a mirar en cada cuadro contra el fondo de ahora. El primer cuadro es la primera idea del fondo, y si la persona
 * respondió apenas se abrió el micrófono («¿Confirmo?» … «Confirmo»), ese cuadro ya era voz: el fondo quedaba tan alto como la voz y
 * nada contaba. Como el fondo baja enseguida cuando se calla, al mirar de nuevo lo dicho al principio cuenta igual.
 */
export function oir(o: Oido, nivel: number, silencioMs = SILENCIO_PARA_ENVIAR_MS): { oido: Oido; termino: boolean; vozMs: number } {
  const n = Math.max(PISO_DB, nivel);
  const niveles = [...o.niveles.slice(-(CUADROS_RECORDADOS - 1)), n];
  // El fondo baja enseguida y sube despacio, y no se mueve mientras habla: si no, la voz misma se volvería fondo.
  const fondo =
    o.fondo === null ? n : esVoz(n, o.fondo) ? o.fondo : n < o.fondo ? o.fondo + (n - o.fondo) / 2 : Math.min(n, o.fondo + SUBIDA_DEL_FONDO_DB);
  let voz = 0;
  for (const x of niveles) if (esVoz(x, fondo)) voz++;
  let callado = 0;
  for (let k = niveles.length - 1; k >= 0 && !esVoz(niveles[k]!, fondo); k--) callado++;
  const vozMs = voz * CUADRO_MS;
  if (vozMs >= VOZ_MINIMA_MS && callado * CUADRO_MS >= silencioMs) return { oido: { fondo, niveles: [] }, termino: true, vozMs };
  return { oido: { fondo, niveles }, termino: false, vozMs };
}
