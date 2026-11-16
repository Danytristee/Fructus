// «Hola Fructus» en el celular: la cadena de openWakeWord 0.6.0 (utils.AudioFeatures y Model.predict) traducida a TypeScript, para
// que el navegador calcule lo mismo que la medición en Python (scripts/voz/palabra-activacion/). Recibe el audio en cuadros de 80 ms
// y devuelve el puntaje de cada uno, de 0 a 1. Cuándo eso es «despertó» lo decide lib/voz/palabra-reglas.ts.
//
// Tres modelos en cadena, los mismos de openWakeWord:
//   1. el espectrograma (melspectrogram.onnx): el audio crudo → 8 cuadros nuevos de 32 bandas cada 80 ms;
//   2. los rasgos (embedding_model.onnx, el speech_embedding de Google): los últimos 76 cuadros del espectrograma → 96 números;
//   3. la frase (hola-fructus.onnx, lo único entrenado para Fructus): los últimos 16 rasgos (1.28 s) → el puntaje.
//
// No sabe de dónde salen los modelos: se los pasa quien la usa (el worker en el navegador, la prueba de paridad en Node). La paridad
// con Python está en detector-palabra.paridad.test.ts; si se cambia algo aquí, esa prueba dice si se rompió.

/** Un modelo ONNX ya cargado: recibe un tensor (los datos y su forma) y devuelve los datos de su salida. */
export type Modelo = (datos: Float32Array, forma: readonly number[]) => Promise<Float32Array>;

export type Modelos = { espectrograma: Modelo; rasgos: Modelo; palabra: Modelo };

export const FRECUENCIA = 16_000;
/** 80 ms: lo que openWakeWord procesa cada vez, y lo que el detector recibe. */
export const MUESTRAS_POR_CUADRO = 1280;
/** openWakeWord le pasa al espectrograma también los últimos 30 ms del cuadro anterior: así los cuadros nuevos empalman. */
const MUESTRAS_PREVIAS = 160 * 3;
const BANDAS = 32;
/** Lo que mira el modelo de rasgos: 76 cuadros del espectrograma (unos 775 ms). */
const VENTANA_ESPECTRO = 76;
const PASO_ESPECTRO = 8;
const RASGOS = 96;
/** Lo que mira el modelo de la frase: 16 rasgos, uno cada 80 ms (1.28 s). */
const VENTANA_RASGOS = 16;
/** openWakeWord da 0 en los primeros 5 cuadros, mientras se llena lo que mira. */
const CUADROS_SIN_PUNTAJE = 5;
/** Lo que se oye al empezar: 4 s de silencio (openWakeWord usa 4 s de ruido al azar; ver la nota de crearDetector). */
const MUESTRAS_DE_ARRANQUE = FRECUENCIA * 4;

export type Detector = {
  /** Un cuadro de 80 ms: MUESTRAS_POR_CUADRO muestras de 16 bits a 16 kHz. Devuelve el puntaje de «Hola Fructus», de 0 a 1. */
  oir: (cuadro: Int16Array) => Promise<number>;
  /** Olvida lo oído y vuelve a empezar, como recién creado: al volver a escuchar después de una pausa. */
  reiniciar: () => void;
  /** Los rasgos más nuevos (96 números): solo para la prueba de paridad. */
  ultimosRasgos: () => Float32Array;
};

/** El espectrograma tal como lo deja openWakeWord: x / 10 + 2, en float32 como numpy (dos redondeos, no uno). */
const ajustar = (x: number) => Math.fround(Math.fround(x / 10) + 2);

/** El espectrograma de un trozo de audio, ya ajustado: una fila de 32 bandas por cuadro. */
async function espectro(modelo: Modelo, muestras: Int16Array): Promise<Float32Array[]> {
  const salida = await modelo(Float32Array.from(muestras), [1, muestras.length]);
  const filas: Float32Array[] = [];
  for (let i = 0; i + BANDAS <= salida.length; i += BANDAS) filas.push(salida.subarray(i, i + BANDAS).map(ajustar));
  return filas;
}

/** Junta filas iguales de largo en un solo bloque, como np.array(filas). */
function juntar(filas: readonly Float32Array[], ancho: number): Float32Array {
  const bloque = new Float32Array(filas.length * ancho);
  filas.forEach((f, i) => bloque.set(f, i * ancho));
  return bloque;
}

/**
 * Carga lo que se oye al empezar y devuelve el detector.
 *
 * Un cambio frente a openWakeWord: el historial de rasgos empieza con los de 4 s de silencio, no con los de 4 s de ruido al azar.
 * Así el detector empieza siempre igual y se puede comparar con Python desde el primer cuadro. Solo cambia el primer segundo y medio,
 * y openWakeWord igual da 0 en los primeros cinco cuadros.
 */
export async function crearDetector(modelos: Modelos): Promise<Detector> {
  // Los rasgos del silencio, como openWakeWord los calcula para un audio entero: ventanas de 76 cuadros cada 8, en un solo lote.
  const silencio = await espectro(modelos.espectrograma, new Int16Array(MUESTRAS_DE_ARRANQUE));
  const ventanas: Float32Array[] = [];
  for (let i = 0; i + VENTANA_ESPECTRO <= silencio.length; i += PASO_ESPECTRO) ventanas.push(juntar(silencio.slice(i, i + VENTANA_ESPECTRO), BANDAS));
  const lote = await modelos.rasgos(juntar(ventanas, VENTANA_ESPECTRO * BANDAS), [ventanas.length, VENTANA_ESPECTRO, BANDAS, 1]);
  const rasgosDelSilencio: Float32Array[] = [];
  for (let i = 0; i + RASGOS <= lote.length; i += RASGOS) rasgosDelSilencio.push(lote.slice(i, i + RASGOS));
  if (rasgosDelSilencio.length < VENTANA_RASGOS) throw new Error("detector: el modelo de rasgos no devolvió lo esperado");

  // Lo que el detector recuerda. openWakeWord guarda más (10 s de audio, 970 cuadros, 120 rasgos), pero solo lee esto.
  let previo = new Int16Array(0);
  let filas: Float32Array[] = [];
  let rasgos: Float32Array[] = [];
  let cuadros = 0;

  const reiniciar = () => {
    previo = new Int16Array(0);
    filas = Array.from({ length: VENTANA_ESPECTRO }, () => new Float32Array(BANDAS).fill(1)); // np.ones((76, 32))
    rasgos = rasgosDelSilencio.slice(-VENTANA_RASGOS);
    cuadros = 0;
  };
  reiniciar();

  async function oir(cuadro: Int16Array): Promise<number> {
    if (cuadro.length !== MUESTRAS_POR_CUADRO) throw new Error(`detector: cada cuadro trae ${MUESTRAS_POR_CUADRO} muestras`);
    // 1. El espectrograma del cuadro, con los 30 ms anteriores (el primero, sin ellos: 5 filas; después, 8).
    const trozo = new Int16Array(previo.length + cuadro.length);
    trozo.set(previo);
    trozo.set(cuadro, previo.length);
    previo = trozo.slice(-MUESTRAS_PREVIAS);
    filas = [...filas, ...(await espectro(modelos.espectrograma, trozo))].slice(-VENTANA_ESPECTRO);
    // 2. Un rasgo nuevo con los últimos 76 cuadros del espectrograma.
    const rasgo = await modelos.rasgos(juntar(filas, BANDAS), [1, VENTANA_ESPECTRO, BANDAS, 1]);
    rasgos = [...rasgos, rasgo.slice(0, RASGOS)].slice(-VENTANA_RASGOS);
    // 3. El puntaje de la frase con los últimos 16 rasgos. Los primeros cuadros dan 0, como en openWakeWord.
    cuadros++;
    if (cuadros <= CUADROS_SIN_PUNTAJE) return 0;
    const [puntaje] = await modelos.palabra(juntar(rasgos, RASGOS), [1, VENTANA_RASGOS, RASGOS]);
    return puntaje ?? 0;
  }

  return { oir, reiniciar, ultimosRasgos: () => rasgos[rasgos.length - 1]! };
}
