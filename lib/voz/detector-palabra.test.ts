import { describe, expect, test } from "vitest";

import { MUESTRAS_POR_CUADRO, crearDetector, type Modelo } from "./detector-palabra";

// El detector con modelos de mentira: qué le pide a cada modelo y en qué orden, sin ONNX Runtime. Que calcula lo mismo que
// openWakeWord lo prueba detector-palabra.paridad.test.ts con los modelos de verdad.

type Llamada = { modelo: "espectrograma" | "rasgos" | "palabra"; forma: number[] };

/** Modelos que responden con la forma de los de verdad y anotan cómo los llamaron. La frase siempre da `puntaje`. */
function modelosDeMentira(puntaje = 0.7) {
  const llamadas: Llamada[] = [];
  const anotar =
    (modelo: Llamada["modelo"], responder: (forma: readonly number[]) => Float32Array): Modelo =>
    async (_datos, forma) => {
      llamadas.push({ modelo, forma: [...forma] });
      return responder(forma);
    };
  return {
    llamadas,
    modelos: {
      // Como melspectrogram.onnx: un cuadro de 32 bandas cada 160 muestras, sin contar los primeros 400 (5 de 1280, 8 de 1760).
      espectrograma: anotar("espectrograma", (forma) => new Float32Array(Math.floor((forma[1]! - 400) / 160) * 32)),
      rasgos: anotar("rasgos", (forma) => new Float32Array(forma[0]! * 96)),
      palabra: anotar("palabra", () => Float32Array.of(puntaje)),
    },
  };
}

const cuadro = () => new Int16Array(MUESTRAS_POR_CUADRO);

describe("el detector de «Hola Fructus»", () => {
  test("al crearse calcula los rasgos de 4 s de silencio en un solo lote", async () => {
    const { llamadas, modelos } = modelosDeMentira();
    await crearDetector(modelos);
    expect(llamadas).toEqual([
      { modelo: "espectrograma", forma: [1, 64_000] },
      { modelo: "rasgos", forma: [41, 76, 32, 1] }, // 397 cuadros de espectrograma: ventanas de 76, cada 8
    ]);
  });

  test("el primer cuadro va solo al espectrograma; los siguientes, con los 30 ms anteriores", async () => {
    const { llamadas, modelos } = modelosDeMentira();
    const detector = await crearDetector(modelos);
    llamadas.length = 0;
    await detector.oir(cuadro());
    await detector.oir(cuadro());
    const espectros = llamadas.filter((l) => l.modelo === "espectrograma").map((l) => l.forma);
    expect(espectros).toEqual([
      [1, 1280],
      [1, 1760],
    ]);
    expect(llamadas.filter((l) => l.modelo === "rasgos").map((l) => l.forma)).toEqual([
      [1, 76, 32, 1],
      [1, 76, 32, 1],
    ]);
  });

  test("los primeros 5 cuadros dan 0 sin preguntarle a la frase; desde el sexto, su puntaje", async () => {
    const { llamadas, modelos } = modelosDeMentira(0.7);
    const detector = await crearDetector(modelos);
    const puntajes = [];
    for (let i = 0; i < 7; i++) puntajes.push(await detector.oir(cuadro()));
    expect(puntajes.map((p) => Number(p.toFixed(3)))).toEqual([0, 0, 0, 0, 0, 0.7, 0.7]);
    expect(llamadas.filter((l) => l.modelo === "palabra").map((l) => l.forma)).toEqual([
      [1, 16, 96],
      [1, 16, 96],
    ]);
  });

  test("reiniciar olvida lo oído: otra vez 5 cuadros en 0 y el espectrograma sin lo anterior", async () => {
    const { llamadas, modelos } = modelosDeMentira(0.7);
    const detector = await crearDetector(modelos);
    for (let i = 0; i < 6; i++) await detector.oir(cuadro());
    detector.reiniciar();
    llamadas.length = 0;
    expect(await detector.oir(cuadro())).toBe(0);
    expect(llamadas[0]).toEqual({ modelo: "espectrograma", forma: [1, 1280] });
  });

  test("un cuadro de otro largo es un error, no un puntaje inventado", async () => {
    const { modelos } = modelosDeMentira();
    const detector = await crearDetector(modelos);
    await expect(detector.oir(new Int16Array(1000))).rejects.toThrow(/1280 muestras/);
  });
});
