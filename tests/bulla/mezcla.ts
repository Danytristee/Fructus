import { readFileSync } from "node:fs";

// Arma un dictado con la bulla del mercado encima, para probar cuándo se da por terminado (lib/voz/silencio-reglas.bulla.test.ts).
// Los audios son voces sintéticas del Mac (scripts/voz/bulla/generar.sh); el ruido de la calle y los golpes se fabrican aquí. Todo sale
// igual cada vez: el azar tiene semilla fija.

export const FRECUENCIA = 16_000;

export type Dictado = "venta" | "pensando" | "abono";
/**
 * - calle: un rumor parejo, como el tráfico de la avenida (ruido rosa).
 * - vecinos: seis voces que pregonan y conversan, que van y vienen con huecos entre una y otra.
 * - golpes: jabas que caen y cajas que se arrastran, cortos y fuertes.
 */
export type Ruido = "ninguno" | "calle" | "vecinos" | "vecinos+golpes" | "vecinos+golpes+calle";

export type Escenario = {
  dictado: Dictado;
  ruido: Ruido;
  /** Cuánto más fuerte suena quien dicta que la bulla (dB). */
  snrDb: number;
  /** Un vecino grita a mitad del dictado: `db` más fuerte que quien dicta, en la fracción `donde` de lo dicho. */
  grito?: { db: number; donde: number };
  /** Cuándo empieza a hablar desde que se abrió el micrófono (s). */
  inicioS?: number;
};

/** Cuánto dura cada escenario: el dictado y varios segundos de bulla después. */
const LARGO_S = 14;
/** El volumen de quien dicta mientras habla (dB respecto del máximo): un palmo del celular. */
const VOZ_DB = -20;
/** Un tramo de 50 ms es voz en el audio limpio si pasa esto: así se sabe dónde terminó de hablar. */
const VOZ_LIMPIA_DB = -45;
const TRAMO = 800;

const cache = new Map<string, Float32Array>();
function leer(nombre: string): Float32Array {
  const ya = cache.get(nombre);
  if (ya) return ya;
  const b = readFileSync(`tests/bulla/${nombre}.wav`);
  for (let i = 12; i + 8 <= b.length; ) {
    const id = b.toString("ascii", i, i + 4);
    const largo = b.readUInt32LE(i + 4);
    if (id === "data") {
      const pcm = new Int16Array(b.buffer.slice(b.byteOffset + i + 8, b.byteOffset + i + 8 + largo));
      const muestras = Float32Array.from(pcm, (x) => x / 32768);
      cache.set(nombre, muestras);
      return muestras;
    }
    i += 8 + largo + (largo % 2);
  }
  throw new Error(`${nombre}.wav no tiene audio`);
}

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
const db = (x: Float32Array) => 20 * Math.log10(rms(x) + 1e-12);

/** El volumen de lo hablado, sin contar los silencios entre palabras. */
function rmsDeLoHablado(x: Float32Array): number {
  let suma = 0;
  let n = 0;
  for (let i = 0; i + TRAMO <= x.length; i += TRAMO) {
    const t = x.subarray(i, i + TRAMO);
    if (db(t) > VOZ_LIMPIA_DB) {
      suma += rms(t) ** 2 * TRAMO;
      n += TRAMO;
    }
  }
  return Math.sqrt(suma / n);
}

function azarCon(semilla: number) {
  let s = semilla;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function bulla(ruido: Ruido, largo: number): Float32Array {
  const azar = azarCon(7);
  const out = new Float32Array(largo);
  if (ruido.includes("calle")) {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < largo; i++) {
      const w = azar() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      out[i]! += (b0 + b1 + b2 + w * 0.1848) * 0.05;
    }
  }
  if (ruido.includes("vecinos")) {
    for (let k = 0; k < 6; k++) {
      const voz = leer(`vecino-${k + 1}`);
      const ganancia = 0.35 + (0.25 * ((k * 37) % 5)) / 4; // unos más cerca que otros
      for (let t = Math.floor(k * 0.7 * FRECUENCIA); t < largo; t += voz.length + Math.floor(azar() * 1.5 * FRECUENCIA)) {
        for (let i = 0; i < voz.length && t + i < largo; i++) out[t + i]! += voz[i]! * ganancia;
      }
    }
  }
  if (ruido.includes("golpes")) {
    for (let t = Math.floor(azar() * FRECUENCIA); t < largo; t += Math.floor(0.4 * FRECUENCIA + azar() * 1.6 * FRECUENCIA)) {
      const dura = Math.floor(0.03 * FRECUENCIA + azar() * 0.08 * FRECUENCIA);
      const fuerza = 0.3 + azar() * 0.7;
      for (let i = 0; i < dura && t + i < largo; i++) out[t + i]! += (azar() * 2 - 1) * fuerza * Math.exp(-i / (0.02 * FRECUENCIA));
    }
  }
  return out;
}

/** El audio del escenario y en qué ms terminó de hablar quien dicta (contado desde que se abrió el micrófono). */
export function mezclar(e: Escenario): { muestras: Float32Array; finVozMs: number } {
  const voz = leer(`dictado-${e.dictado}`);
  const largo = LARGO_S * FRECUENCIA;
  const inicio = Math.floor((e.inicioS ?? 1) * FRECUENCIA);
  const ganancia = 10 ** (VOZ_DB / 20) / rmsDeLoHablado(voz);
  let fin = 0;
  for (let i = 0; i + TRAMO <= voz.length; i += TRAMO) if (db(voz.subarray(i, i + TRAMO)) > VOZ_LIMPIA_DB) fin = i + TRAMO;

  const out = new Float32Array(largo);
  if (e.ruido !== "ninguno") {
    const r = bulla(e.ruido, largo);
    const g = 10 ** ((VOZ_DB - e.snrDb) / 20) / rms(r);
    for (let i = 0; i < largo; i++) out[i] = r[i]! * g;
  }
  for (let i = 0; i < voz.length; i++) out[inicio + i]! += voz[i]! * ganancia;
  if (e.grito) {
    const grito = leer("vecino-4").subarray(0, Math.floor(0.8 * FRECUENCIA));
    const g = 10 ** ((VOZ_DB + e.grito.db) / 20) / rmsDeLoHablado(grito);
    const en = inicio + Math.floor(fin * e.grito.donde);
    for (let i = 0; i < grito.length; i++) out[en + i]! += grito[i]! * g;
  }
  for (let i = 0; i < largo; i++) out[i] = Math.max(-1, Math.min(1, out[i]!));
  return { muestras: out, finVozMs: ((inicio + fin) / FRECUENCIA) * 1000 };
}
