// Cuándo dejó de hablar, para enviar lo dictado sin un segundo toque (modo sin mantener, ADR-0018). Lógica pura: recibe el volumen
// del micrófono cada CUADRO_MS (y, si está, lo que dice Silero) y dice cuándo terminó. No importa React ni el audio del navegador.
//
// Dos preguntas por cuadro:
// 1. ¿Es alguien hablando? Con Silero (lib/voz/detector-voz.ts), lo dice él: un motor o una jaba que cae no son voz aunque suenen
//    fuerte. Sin Silero (mientras baja, o si no pudo), se mide el volumen: es «alguien» lo que suena por encima del fondo.
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
/** Silero dice que un cuadro es voz si da al menos esto (de 0 a 1): el umbral que recomiendan sus autores. */
const UMBRAL_SILERO = 0.5;

/** Un cuadro de 50 ms: su volumen (dB) y lo que dijo Silero (de 0 a 1), o null si se mide solo el volumen. */
type Cuadro = { db: number; silero: number | null };

/**
 * Lo que lleva oído: el ruido de fondo y la voz de quien dicta (`vozDb`; null antes de saberlos), y cada cuadro desde que empezó a
 * escuchar (o desde la última vez que terminó). Se guardan para volver a mirarlos contra el fondo y la voz de ahora: ver `oir`.
 * `hablandoMs`: cuánto pasó desde que empezó a hablar (null antes), para el tope.
 */
export type Oido = { fondo: number | null; vozDb: number | null; cuadros: Cuadro[]; hablandoMs: number | null };

export const OIDO_NUEVO: Oido = { fondo: null, vozDb: null, cuadros: [], hablandoMs: null };

/** Cuántos cuadros se recuerdan: 20 s. Para decidir si se calló no hace falta mirar más atrás. */
const CUADROS_RECORDADOS = 400;

const suena = (nivel: number, fondo: number) => nivel > SILENCIO_ABSOLUTO_DB && nivel >= fondo + SOBRE_EL_FONDO_DB;
/** Alguien habla en este cuadro: lo dice Silero, o sin él, el volumen sobre el fondo. */
const habla = (c: Cuadro, fondo: number) => (c.silero === null ? suena(c.db, fondo) : c.db > SILENCIO_ABSOLUTO_DB && c.silero >= UMBRAL_SILERO);
/** Y es quien dicta: suena cerca de su voz. */
const esVoz = (c: Cuadro, fondo: number, vozDb: number | null) => habla(c, fondo) && (vozDb === null || c.db >= vozDb - BAJO_LA_VOZ_DB);

/** El volumen de un trozo de audio (muestras de -1 a 1), en dB respecto del máximo. Un trozo mudo da PISO_DB. */
export function nivelDb(muestras: ArrayLike<number>): number {
  if (muestras.length === 0) return PISO_DB;
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i]! * muestras[i]!;
  const rms = Math.sqrt(suma / muestras.length);
  return rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB;
}

/**
 * La voz de quien dicta, con un cuadro más: el volumen al que se habla en más de la mitad del último segundo y medio (lo que no es
 * alguien hablando cuenta como silencio), o lo de antes, que baja despacio.
 */
function vozDeQuienDicta(antes: number | null, cuadros: readonly Cuadro[], fondo: number): number | null {
  const ultimos = cuadros
    .slice(-CUADROS_DE_LA_VOZ)
    .map((c) => (habla(c, fondo) ? c.db : PISO_DB))
    .sort((a, b) => a - b);
  const sostenido = ultimos[Math.floor((ultimos.length - 1) * PARTE_DE_LA_VOZ)]!;
  const bajada = antes === null ? null : antes - BAJADA_DE_LA_VOZ_DB;
  if (sostenido <= SILENCIO_ABSOLUTO_DB) return bajada;
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
export function oir(
  o: Oido,
  nivel: number,
  silencioMs = SILENCIO_PARA_ENVIAR_MS,
  /** Lo que dijo Silero de este cuadro (de 0 a 1). Sin él, se decide solo por el volumen. */
  silero: number | null = null,
): { oido: Oido; termino: boolean; vozMs: number } {
  const n = Math.max(PISO_DB, nivel);
  const cuadros = [...o.cuadros.slice(-(CUADROS_RECORDADOS - 1)), { db: n, silero }];
  // El fondo baja enseguida y sube despacio, y no se mueve mientras algo suena: si no, la voz misma se volvería fondo.
  const fondo =
    o.fondo === null ? n : suena(n, o.fondo) ? o.fondo : n < o.fondo ? o.fondo + (n - o.fondo) / 2 : Math.min(n, o.fondo + SUBIDA_DEL_FONDO_DB);
  const vozDb = vozDeQuienDicta(o.vozDb, cuadros, fondo);
  let cuadrosConVoz = 0;
  for (const c of cuadros) if (esVoz(c, fondo, vozDb)) cuadrosConVoz++;
  let callado = 0;
  for (let k = cuadros.length - 1; k >= 0 && !esVoz(cuadros[k]!, fondo, vozDb); k--) callado++;
  const vozMs = cuadrosConVoz * CUADRO_MS;
  // Empezó a hablar cuando ya lleva la voz mínima: un golpe suelto no echa a andar el tope. Desde ahí cuenta aunque después calle.
  const hablandoMs = o.hablandoMs !== null ? o.hablandoMs + CUADRO_MS : vozMs >= VOZ_MINIMA_MS ? VOZ_MINIMA_MS : null;
  const termino = vozMs >= VOZ_MINIMA_MS && (callado * CUADRO_MS >= silencioMs || (hablandoMs ?? 0) >= TOPE_HABLANDO_MS);
  if (termino) return { oido: { fondo, vozDb, cuadros: [], hablandoMs: null }, termino, vozMs };
  return { oido: { fondo, vozDb, cuadros, hablandoMs }, termino, vozMs };
}
