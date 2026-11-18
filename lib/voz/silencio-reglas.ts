// Cuándo dejó de hablar, para enviar lo dictado sin un segundo toque (modo sin mantener, ADR-0018). Lógica pura: recibe el volumen
// del micrófono cada CUADRO_MS y dice cuándo terminó. No importa React ni el audio del navegador (eso es useGrabadora).
//
// Mide el volumen, no reconoce la voz. Dos preguntas por cuadro:
// 1. ¿Suena por encima del fondo? Lo que no, es silencio.
// 2. ¿Suena cerca de la voz de quien dicta? Quien dicta tiene el celular a un palmo de la boca: es lo más fuerte que se oye. La
//    bulla del mercado (el vecino que pregona, una jaba que cae, otra conversación) suena más bajo y no cuenta como su voz.
//
// Sin la segunda pregunta, con bulla nunca «se callaba»: el fondo bajaba a los huecos entre grito y grito, y cualquier voz ajena quedaba
// por encima y volvía a cero la cuenta del silencio (docs/bitacora/2026-11-18-voz-fin-de-habla-con-bulla.md). Si la bulla suena tan
// fuerte como quien dicta, el volumen no alcanza para separarlas: nunca «se calla», y se envía a los TOPE_HABLANDO_MS de empezar a
// hablar (o antes, con un toque).

/** Cada cuánto se mide el volumen (ms). */
export const CUADRO_MS = 50;
/** Silencio después de hablar que basta para enviar. Una pausa para pensar el precio dura menos. */
export const SILENCIO_PARA_ENVIAR_MS = 1200;
/** Voz mínima antes de que el silencio cuente: un golpe o una tos sueltos no envían nada. */
export const VOZ_MINIMA_MS = 400;
/**
 * Desde que empezó a hablar, a los 15 s se envía aunque no se calle: con un vecino que pregona tan fuerte como quien dicta, nunca «se
 * calla». La venta más larga de los casos del intérprete («Vendí 10 cajas de mango a don Lucho a 500, pagó 1000 con Yape y 500 en
 * efectivo, lo demás lo debe») se dice en unos 9 s.
 */
export const TOPE_HABLANDO_MS = 15_000;
/** Un cuadro suena si está al menos esto por encima del fondo (dB). */
const SOBRE_EL_FONDO_DB = 12;
/** Por debajo de esto siempre es silencio (dB respecto del máximo del micrófono). */
const SILENCIO_ABSOLUTO_DB = -60;
/** Lo más bajo que se cuenta: el silencio digital es -∞. */
const PISO_DB = -100;
/** Cuánto sube el fondo por cuadro cuando no suena nada: un motor que arranca despacio no se vuelve «voz» (2 dB por segundo). */
const SUBIDA_DEL_FONDO_DB = 0.1;
/** Es la voz de quien dicta si suena hasta esto por debajo de su voz (dB). Más bajo es alguien más lejos, o el ruido. */
const BAJO_LA_VOZ_DB = 10;
/**
 * La voz de quien dicta es lo que suena en más de la mitad del último segundo y medio: quien dicta habla seguido varios segundos, y
 * un grito del vecino o una jaba que cae duran menos. Si un grito la subiera, lo que sigue de la venta sonaría «más bajo que la voz» y
 * contaría como silencio: cortaría la venta por la mitad.
 */
const CUADROS_DE_LA_VOZ = 30;
const PARTE_DE_LA_VOZ = 0.45;
/** Lo que baja la voz de quien dicta por cuadro cuando nada la sostiene (0.5 dB por segundo): la bulla de después no la alcanza. */
const BAJADA_DE_LA_VOZ_DB = 0.025;

/**
 * Lo que lleva oído: el ruido de fondo y la voz de quien dicta (null antes de saberlos), y el volumen de cada cuadro desde que empezó a
 * escuchar (o desde la última vez que terminó). Se guardan para volver a mirarlos contra el fondo y la voz de ahora: ver `oir`.
 * `hablandoMs`: cuánto pasó desde que empezó a hablar (null antes), para el tope.
 */
export type Oido = { fondo: number | null; voz: number | null; niveles: number[]; hablandoMs: number | null };

export const OIDO_NUEVO: Oido = { fondo: null, voz: null, niveles: [], hablandoMs: null };

/** Cuántos cuadros se recuerdan: 20 s. Para decidir si se calló no hace falta mirar más atrás. */
const CUADROS_RECORDADOS = 400;

const suena = (nivel: number, fondo: number) => nivel > SILENCIO_ABSOLUTO_DB && nivel >= fondo + SOBRE_EL_FONDO_DB;
const esVoz = (nivel: number, fondo: number, voz: number | null) => suena(nivel, fondo) && (voz === null || nivel >= voz - BAJO_LA_VOZ_DB);

/** El volumen de un trozo de audio (muestras de -1 a 1), en dB respecto del máximo. Un trozo mudo da PISO_DB. */
export function nivelDb(muestras: ArrayLike<number>): number {
  if (muestras.length === 0) return PISO_DB;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i]! * muestras[i]!;
  const rms = Math.sqrt(suma / muestras.length);
  return rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB;
}

/** La voz de quien dicta, con un cuadro más: lo que suena sostenido en el último segundo y medio, o lo de antes, que baja despacio. */
function vozDeQuienDicta(antes: number | null, niveles: readonly number[], fondo: number): number | null {
  const ultimos = niveles.slice(-CUADROS_DE_LA_VOZ).sort((a, b) => a - b);
  const sostenido = ultimos[Math.floor((ultimos.length - 1) * PARTE_DE_LA_VOZ)]!;
  const bajada = antes === null ? null : antes - BAJADA_DE_LA_VOZ_DB;
  if (!suena(sostenido, fondo)) return bajada;
  return bajada === null ? sostenido : Math.max(sostenido, bajada);
}

/**
 * Un cuadro más. `termino`: habló al menos VOZ_MINIMA_MS y después calló `silencioMs` seguidos (un dictado, SILENCIO_PARA_ENVIAR_MS;
 * una respuesta de una palabra, menos), o ya lleva TOPE_HABLANDO_MS desde que empezó a hablar. Al terminar, lo oído se reinicia (el fondo y la voz se conservan): si el dedo seguía encima y no
 * se envió, la próxima vez que se calle vuelve a avisar. `vozMs`: cuánta voz lleva, para saber si ya empezó a hablar.
 *
 * Lo oído se vuelve a mirar en cada cuadro contra el fondo y la voz de ahora. El primer cuadro es la primera idea del fondo, y si la
 * persona respondió apenas se abrió el micrófono («¿Confirmo?» … «Confirmo»), ese cuadro ya era voz: el fondo quedaba tan alto como la
 * voz y nada contaba. Como el fondo baja enseguida cuando se calla, al mirar de nuevo lo dicho al principio cuenta igual. Con la voz
 * pasa lo mismo: la bulla de antes de que hablara contaba como voz mientras la voz no se sabía, y deja de contar cuando se sabe.
 */
export function oir(o: Oido, nivel: number, silencioMs = SILENCIO_PARA_ENVIAR_MS): { oido: Oido; termino: boolean; vozMs: number } {
  const n = Math.max(PISO_DB, nivel);
  const niveles = [...o.niveles.slice(-(CUADROS_RECORDADOS - 1)), n];
  // El fondo baja enseguida y sube despacio, y no se mueve mientras algo suena: si no, la voz misma se volvería fondo.
  const fondo =
    o.fondo === null ? n : suena(n, o.fondo) ? o.fondo : n < o.fondo ? o.fondo + (n - o.fondo) / 2 : Math.min(n, o.fondo + SUBIDA_DEL_FONDO_DB);
  const voz = vozDeQuienDicta(o.voz, niveles, fondo);
  let cuadrosConVoz = 0;
  for (const x of niveles) if (esVoz(x, fondo, voz)) cuadrosConVoz++;
  let callado = 0;
  for (let k = niveles.length - 1; k >= 0 && !esVoz(niveles[k]!, fondo, voz); k--) callado++;
  const vozMs = cuadrosConVoz * CUADRO_MS;
  // Empezó a hablar cuando ya lleva la voz mínima: un golpe suelto no echa a andar el tope. Desde ahí cuenta aunque después calle.
  const hablandoMs = o.hablandoMs !== null ? o.hablandoMs + CUADRO_MS : vozMs >= VOZ_MINIMA_MS ? VOZ_MINIMA_MS : null;
  const termino = vozMs >= VOZ_MINIMA_MS && (callado * CUADRO_MS >= silencioMs || (hablandoMs ?? 0) >= TOPE_HABLANDO_MS);
  if (termino) return { oido: { fondo, voz, niveles: [], hablandoMs: null }, termino, vozMs };
  return { oido: { fondo, voz, niveles, hablandoMs }, termino, vozMs };
}
