// Cuándo el puntaje de «Hola Fructus» (lib/voz/detector-palabra.ts) cuenta como «despertó». Lógica pura: es la misma regla con que
// se midió el modelo (`activaciones` en scripts/voz/palabra-activacion/medir.py), así lo medido vale para la app.
//
// Con el modelo provisional, umbral 0.9 y 3 cuadros seguidos: 90 % de detección sin ruido y 1.04 falsas por hora con ruido
// (docs/voz/palabra-activacion-2026-11-14-provisional.md). Pedir varios cuadros seguidos es lo que más baja las falsas: un golpe o
// una palabra suelta pasan el umbral en un cuadro, la frase entera lo sostiene.

/** El puntaje que hay que pasar en cada cuadro. */
export const UMBRAL = 0.9;
/** Cuántos cuadros de 80 ms seguidos sobre el umbral hacen falta (240 ms). */
export const CUADROS_SEGUIDOS = 3;
/** Después de despertar, 2 s (25 cuadros de 80 ms) sin volver a despertar: la misma frase no despierta dos veces. */
export const CUADROS_DE_ESPERA = 25;

export type Atencion = {
  /** Cuadros seguidos sobre el umbral hasta ahora. */
  seguidos: number;
  /** Cuadros que faltan para volver a escuchar después de despertar. */
  espera: number;
};

export const ATENCION_NUEVA: Atencion = { seguidos: 0, espera: 0 };

/** Un puntaje más. `desperto`: es el cuadro en que se completó la frase. */
export function atender(a: Atencion, puntaje: number): { atencion: Atencion; desperto: boolean } {
  if (a.espera > 0) return { atencion: { seguidos: 0, espera: a.espera - 1 }, desperto: false };
  const seguidos = puntaje >= UMBRAL ? a.seguidos + 1 : 0;
  if (seguidos >= CUADROS_SEGUIDOS) return { atencion: { seguidos: 0, espera: CUADROS_DE_ESPERA }, desperto: true };
  return { atencion: { seguidos, espera: 0 }, desperto: false };
}

// ── El segundo paso, en el servidor (actividad 5d) ─────────────────────────────────────────────────────────────────────────────
// El detector despierta también con un 11 % de las frases con «fruta» («hola, ¿hay frutas?»): para el modelo, con voces sintéticas,
// casi no se distinguen. Whisper sí las distingue. Lo que se envía después de despertar trae la frase (los 2 s de antes), y aquí se
// mira cómo la escribió Whisper.
//
// No se exige que diga «Fructus»: medido con Groq el 2026-11-16, Whisper escribe bien «Hola Fructus, vendí…» dicho de corrido, pero
// la frase sola sale «Hola, Fro, Bus.» o «Hola, frío, bus…», aunque «Hola Fructus» vaya en el vocabulario. Exigirla tiraría órdenes
// de verdad. Se descarta solo lo que el detector confunde: «fruta», «frutas», «fruto»… al principio, sin «Fructus» antes.

export type Frase =
  /** Whisper escribió la frase: `orden` es lo que se dijo después, lo que se interpreta (vacío si no dijo nada más). */
  | { veredicto: "dijo"; orden: string }
  /** Al principio se oyó «fruta», «frutas», «fruto»…, sin «Fructus» antes: era una frase parecida. Se descarta sin guardar nada. */
  | { veredicto: "parecida" }
  /** Ni lo uno ni lo otro: Whisper escribió mal la marca. Se interpreta todo como vino: el intérprete pasa por alto el saludo. */
  | { veredicto: "dudosa" };

/** Hasta dónde se busca la frase: lo grabado antes de despertar son 2 s, unas 5 palabras. Más adelante ya es la orden. */
const PALABRAS_AL_PRINCIPIO = 5;
const PARECIDA = /^frut(a|as|o|os|ero|era|eros|eras|ita|itas|eria|erias)$/;
const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Cuántas letras hay que cambiar, poner o quitar para pasar de una palabra a otra. */
function distancia(a: string, b: string): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) fila[j] = Math.min(anterior[j]! + 1, fila[j - 1]! + 1, anterior[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    anterior = fila;
  }
  return anterior[b.length]!;
}

/** «Fructus», o a una letra: «Fructos», «Fruktus», «Fructu». «Frutas» y «frutos» están a dos: no cuentan. */
const esFructus = (palabra: string) => palabra.length >= 5 && distancia(palabra, "fructus") <= 1;

/** Cómo escribió Whisper el principio de lo dicho después de despertar (ver arriba). */
export function revisarFrase(texto: string): Frase {
  const palabras = [...texto.matchAll(/[\p{L}\p{N}]+/gu)];
  for (let i = 0; i < Math.min(palabras.length, PALABRAS_AL_PRINCIPIO); i++) {
    const palabra = palabras[i]!;
    const siguiente = palabras[i + 1];
    const esta = sinTildes(palabra[0]);
    // A veces Whisper la parte en dos: «Fruc tus».
    const partida = siguiente !== undefined && !esFructus(esta) && esFructus(esta + sinTildes(siguiente[0]));
    if (esFructus(esta) || partida) {
      const ultima = partida ? siguiente : palabra;
      // Se quita lo que cierra la frase («, », «. », «: ») pero no lo que abre la orden («¿», «¡»).
      const orden = texto.slice(ultima.index + ultima[0].length).replace(/^[\s,.;:!?…»"'\-–—]+/u, "").trim();
      return { veredicto: "dijo", orden };
    }
    if (PARECIDA.test(esta)) return { veredicto: "parecida" };
  }
  return { veredicto: "dudosa" };
}
