import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-web";
import { beforeAll, describe, expect, it } from "vitest";

import { FRECUENCIA, mezclar, type Dictado, type Escenario, type Ruido } from "../../tests/bulla/mezcla";
import { MUESTRAS_POR_VENTANA, crearDetectorVoz, type ModeloVoz } from "./detector-voz";
import { crearFinDeHabla } from "./fin-de-habla";
import { modeloVozDeSesion } from "./modelo-onnx";
import { nivelDb } from "./silencio-reglas";

// Silero de verdad (el mismo modelo que baja el celular, con la versión de ONNX Runtime para Node) sobre los audios con bulla de
// tests/bulla/. Comprueba que el modelo está bien conectado (contexto y estado entre ventanas: sin ellos responde, pero mal) y que,
// con él, el dictado termina donde el volumen solo no alcanzaba. Tarda unos segundos: corre el modelo sobre ~2 minutos de audio.

let modelo: ModeloVoz;
beforeAll(async () => {
  ort.env.wasm.numThreads = 1;
  const sesion = await ort.InferenceSession.create(readFileSync("public/voz/silero_vad_16k_op15.onnx"));
  modelo = modeloVozDeSesion(sesion, ort.Tensor);
});

/** Lo que dice Silero de cada ventana de 32 ms, con su volumen. */
async function ventanas(muestras: Float32Array) {
  const detector = crearDetectorVoz(modelo);
  const out: { voz: number; db: number }[] = [];
  for (let i = 0; i + MUESTRAS_POR_VENTANA <= muestras.length; i += MUESTRAS_POR_VENTANA) {
    const v = muestras.slice(i, i + MUESTRAS_POR_VENTANA);
    out.push({ voz: await detector.oir(v), db: nivelDb(v) });
  }
  return out;
}

const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** En qué ms avisó que se calló, con Silero desde el principio, pasándole el audio en trozos de 80 ms como el navegador. */
async function terminaEn(muestras: Float32Array): Promise<number | null> {
  const fin = crearFinDeHabla();
  await fin.conSilero(crearDetectorVoz(modelo));
  for (let i = 0; i + 1280 <= muestras.length; i += 1280) {
    if ((await fin.oir(muestras.slice(i, i + 1280))).callo) return ((i + 1280) / FRECUENCIA) * 1000;
  }
  return null;
}

async function demora(e: Escenario): Promise<number | null> {
  const { muestras, finVozMs } = mezclar(e);
  const fin = await terminaEn(muestras);
  return fin === null ? null : fin - finVozMs;
}

const DICTADOS: Dictado[] = ["venta", "pensando", "abono"];
const nombre = (e: Escenario) => `${e.dictado}, ${e.ruido}, ${e.snrDb} dB${e.grito ? `, grito de ${e.grito.db} dB` : ""}`;

describe("Silero de verdad", () => {
  it("oye la voz donde hay voz y no la oye en el silencio", async () => {
    const { muestras } = mezclar({ dictado: "venta", ruido: "ninguno", snrDb: 0 });
    const v = await ventanas(muestras);
    expect(promedio(v.filter((x) => x.db > -40).map((x) => x.voz))).toBeGreaterThan(0.7);
    expect(promedio(v.filter((x) => x.db < -80).map((x) => x.voz))).toBeLessThan(0.1);
  });

  it("el rumor fuerte de la calle no es voz", async () => {
    // Los 2.5 s de antes de que hable: solo la calle, a 5 dB de la voz.
    const { muestras } = mezclar({ dictado: "venta", ruido: "calle", snrDb: 5, inicioS: 3 });
    const v = await ventanas(muestras.subarray(0, 2.5 * FRECUENCIA));
    expect(promedio(v.map((x) => x.voz))).toBeLessThan(0.2);
  });

  it("con la calle casi tan fuerte como la voz, termina al callarse (con el volumen solo, nunca)", async () => {
    for (const dictado of DICTADOS) {
      const e = { dictado, ruido: "calle" as Ruido, snrDb: 5 };
      expect(await demora(e), nombre(e)).toBeGreaterThanOrEqual(300);
      expect(await demora(e), nombre(e)).toBeLessThanOrEqual(2000);
    }
  }, 120_000);

  it("con vecinos 20 dB por debajo, termina al callarse, y un vecino que grita no corta la venta", async () => {
    for (const dictado of DICTADOS) {
      const e = { dictado, ruido: "vecinos" as Ruido, snrDb: 20 };
      expect(await demora(e), nombre(e)).toBeGreaterThanOrEqual(800);
      expect(await demora(e), nombre(e)).toBeLessThanOrEqual(2000);
      const g = { dictado, ruido: "vecinos" as Ruido, snrDb: 15, grito: { db: 20, donde: 0.1 }, inicioS: 0.3 };
      expect(await demora(g), nombre(g)).toBeGreaterThanOrEqual(300);
    }
  }, 120_000);
});
