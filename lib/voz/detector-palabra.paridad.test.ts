import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-web";
import { beforeAll, describe, expect, test } from "vitest";

import { MUESTRAS_POR_CUADRO, crearDetector, type Detector } from "./detector-palabra";
import { modeloDeSesion } from "./modelo-onnx";
import { ATENCION_NUEVA, atender } from "./palabra-reglas";

// El detector de la app contra openWakeWord en Python, con los mismos modelos y los mismos audios (actividad 5b). La referencia la
// deja scripts/voz/palabra-activacion/referencia.py en tests/palabra/: si se cambia un modelo, se vuelve a correr ese script.
// Corre ONNX Runtime de verdad (la misma biblioteca que el navegador, en su versión para Node): tarda un par de segundos.

type Referencia = {
  modelos: Record<string, string>;
  puntajes: Record<string, number[]>;
  rasgos: Record<string, number[][]>;
};

const referencia = JSON.parse(readFileSync("tests/palabra/referencia.json", "utf8")) as Referencia;
const MODELOS = { espectrograma: "public/voz/melspectrogram.onnx", rasgos: "public/voz/embedding_model.onnx", palabra: "public/voz/hola-fructus.onnx" };
/** Lo que se acepta de diferencia en cada cuadro: el puntaje va de 0 a 1 y los rasgos, de -40 a 40. */
const TOLERANCIA = 0.01;

/** Las muestras de un WAV mono de 16 bits a 16 kHz, como los de tests/palabra. */
function leerWav(ruta: string): Int16Array {
  const b = readFileSync(ruta);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${ruta}: no es un WAV`);
  for (let i = 12; i + 8 <= b.length; ) {
    const id = b.toString("ascii", i, i + 4);
    const largo = b.readUInt32LE(i + 4);
    if (id === "fmt " && (b.readUInt16LE(i + 8) !== 1 || b.readUInt16LE(i + 10) !== 1 || b.readUInt32LE(i + 12) !== 16_000 || b.readUInt16LE(i + 22) !== 16)) {
      throw new Error(`${ruta}: tiene que ser PCM mono de 16 bits a 16 kHz`);
    }
    if (id === "data") return new Int16Array(b.buffer.slice(b.byteOffset + i + 8, b.byteOffset + i + 8 + largo));
    i += 8 + largo + (largo % 2);
  }
  throw new Error(`${ruta}: no tiene audio`);
}

let detector: Detector;

beforeAll(async () => {
  ort.env.wasm.numThreads = 1; // como en el celular sin aislamiento entre orígenes
  const cargar = async (ruta: string) => modeloDeSesion(await ort.InferenceSession.create(readFileSync(ruta)), ort.Tensor);
  detector = await crearDetector({
    espectrograma: await cargar(MODELOS.espectrograma),
    rasgos: await cargar(MODELOS.rasgos),
    palabra: await cargar(MODELOS.palabra),
  });
});

/** El puntaje de cada cuadro de un audio, desde un detector recién empezado. `alOir` mira el detector después de cada cuadro. */
async function puntajes(audio: string, alOir?: (i: number) => void): Promise<number[]> {
  const muestras = leerWav(`tests/palabra/${audio}`);
  detector.reiniciar();
  const salida: number[] = [];
  for (let i = 0; (i + 1) * MUESTRAS_POR_CUADRO <= muestras.length; i++) {
    salida.push(await detector.oir(muestras.subarray(i * MUESTRAS_POR_CUADRO, (i + 1) * MUESTRAS_POR_CUADRO)));
    alOir?.(i);
  }
  return salida;
}

const veces = (lista: number[]) => {
  let atencion = ATENCION_NUEVA;
  let n = 0;
  for (const p of lista) {
    const r = atender(atencion, p);
    atencion = r.atencion;
    if (r.desperto) n++;
  }
  return n;
};

describe("el detector del navegador calcula lo mismo que openWakeWord en Python", () => {
  test("la referencia es de estos mismos modelos", () => {
    const sha = (ruta: string) => createHash("sha256").update(readFileSync(ruta)).digest("hex");
    expect(sha(MODELOS.palabra), "cambió hola-fructus.onnx: vuelve a correr referencia.py").toBe(referencia.modelos["hola-fructus.onnx"]);
    expect(sha(MODELOS.espectrograma)).toBe(referencia.modelos["melspectrogram.onnx"]);
    expect(sha(MODELOS.rasgos)).toBe(referencia.modelos["embedding_model.onnx"]);
  });

  test("los rasgos de cada cuadro de «Hola Fructus» son los de Python", async () => {
    const esperados = referencia.rasgos["hola-fructus.wav"]!;
    let peor = 0;
    await puntajes("hola-fructus.wav", (i) => {
      const r = detector.ultimosRasgos();
      esperados[i]!.forEach((v, k) => (peor = Math.max(peor, Math.abs(v - r[k]!))));
    });
    expect(peor).toBeLessThan(TOLERANCIA);
  });

  test.each(Object.keys(referencia.puntajes))("el puntaje de cada cuadro de %s es el de Python", async (audio) => {
    const esperados = referencia.puntajes[audio]!;
    const obtenidos = await puntajes(audio);
    expect(obtenidos).toHaveLength(esperados.length);
    const peor = Math.max(...obtenidos.map((p, i) => Math.abs(p - esperados[i]!)));
    expect(peor).toBeLessThan(TOLERANCIA);
  });

  test("despierta una vez con «Hola Fructus» y ninguna con una venta o con «Hola, ¿hay frutas?»", async () => {
    expect(veces(await puntajes("hola-fructus.wav"))).toBe(1);
    expect(veces(await puntajes("puesto.wav"))).toBe(0);
    expect(veces(await puntajes("hola-frutas.wav"))).toBe(0);
  });
});
