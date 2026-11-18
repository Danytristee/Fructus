import { describe, expect, it } from "vitest";

import { FRECUENCIA, mezclar, type Dictado, type Escenario, type Ruido } from "../../tests/bulla/mezcla";
import { CUADRO_MS, OIDO_NUEVO, TOPE_HABLANDO_MS, nivelDb, oir } from "./silencio-reglas";

// Cuándo se da por terminado un dictado con la bulla del mercado encima, sobre audio de verdad: voces sintéticas del Mac
// (tests/bulla/) mezcladas con vecinos que pregonan, golpes de jabas y el rumor de la calle. Antes de comparar contra la voz de quien
// dicta, con vecinos nunca terminaba, ni con la voz 25 dB por encima (docs/bitacora/2026-11-18-voz-fin-de-habla-con-bulla.md).

const MUESTRAS_POR_CUADRO = (FRECUENCIA * CUADRO_MS) / 1000;
const DICTADOS: Dictado[] = ["venta", "pensando", "abono"];

/** En qué ms se dio por terminado (al callarse o al tope), o null si nunca. */
function terminaEn(muestras: Float32Array): number | null {
  let o = OIDO_NUEVO;
  for (let i = 0; i + MUESTRAS_POR_CUADRO <= muestras.length; i += MUESTRAS_POR_CUADRO) {
    const r = oir(o, nivelDb(muestras.subarray(i, i + MUESTRAS_POR_CUADRO)));
    o = r.oido;
    if (r.termino) return ((i + MUESTRAS_POR_CUADRO) / FRECUENCIA) * 1000;
  }
  return null;
}

/** Cuánto después de callarse terminó (ms), o null si nunca. */
function demora(e: Escenario): number | null {
  const { muestras, finVozMs } = mezclar(e);
  const fin = terminaEn(muestras);
  return fin === null ? null : fin - finVozMs;
}

const nombre = (e: Escenario) => `${e.dictado}, ${e.ruido}, ${e.snrDb} dB${e.grito ? `, grito de ${e.grito.db} dB` : ""}`;

describe("con bulla de verdad", () => {
  it("en silencio y con el rumor parejo de la calle, termina al callarse, como siempre", () => {
    for (const dictado of DICTADOS)
      for (const [ruido, snrDb] of [["ninguno", 0], ["calle", 20], ["calle", 15], ["calle", 10]] as [Ruido, number][]) {
        const e = { dictado, ruido, snrDb };
        expect(demora(e), nombre(e)).toBeGreaterThanOrEqual(800);
        expect(demora(e), nombre(e)).toBeLessThanOrEqual(1500);
      }
  });

  it("con vecinos que pregonan y jabas que caen, 20 dB por debajo de quien dicta, termina al callarse, como en silencio", () => {
    for (const dictado of DICTADOS)
      for (const inicioS of [0.3, 1, 2])
        for (const ruido of ["vecinos", "vecinos+golpes"] as Ruido[]) {
          const e = { dictado, ruido, snrDb: 20, inicioS };
          expect(demora(e), nombre(e)).toBeGreaterThanOrEqual(800);
          expect(demora(e), nombre(e)).toBeLessThanOrEqual(1500);
        }
  });

  it("y 15 dB por debajo también termina, aunque a veces tarda más (hasta 4 s): la bulla que se cuela todavía suena cerca de la voz", () => {
    for (const dictado of DICTADOS)
      for (const inicioS of [0.3, 1, 2])
        for (const ruido of ["vecinos", "vecinos+golpes"] as Ruido[]) {
          const e = { dictado, ruido, snrDb: 15, inicioS };
          expect(demora(e), nombre(e)).not.toBeNull();
          expect(demora(e)!, nombre(e)).toBeLessThanOrEqual(4000);
        }
  });

  it("con vecinos casi tan fuertes como quien dicta (10 y 5 dB), el volumen no los separa, pero igual termina: a más tardar en el tope", () => {
    for (const dictado of DICTADOS)
      for (const inicioS of [0.3, 2])
        for (const ruido of ["vecinos", "vecinos+golpes"] as Ruido[])
          for (const snrDb of [10, 5]) {
            const e = { dictado, ruido, snrDb, inicioS, largoS: 20 };
            const fin = terminaEn(mezclar(e).muestras);
            expect(fin, nombre(e)).not.toBeNull();
            expect(fin!, nombre(e)).toBeLessThanOrEqual(inicioS * 1000 + TOPE_HABLANDO_MS + 1000);
          }
  });

  it("nunca corta antes de que termine de hablar: ni en la pausa para pensar el precio, ni con la bulla fuerte, ni si un vecino grita", () => {
    const escenarios: Escenario[] = [];
    for (const dictado of DICTADOS)
      for (const inicioS of [0.3, 2]) {
        for (const ruido of ["calle", "vecinos", "vecinos+golpes", "vecinos+golpes+calle"] as Ruido[])
          for (const snrDb of [20, 10, 5]) escenarios.push({ dictado, ruido, snrDb, inicioS });
        for (const db of [8, 14, 20])
          for (const donde of [0.1, 0.35, 0.6]) escenarios.push({ dictado, ruido: "vecinos", snrDb: 15, grito: { db, donde }, inicioS });
      }
    // Lo que importa es que el audio llegue entero: termina después de la última palabra, con margen.
    for (const e of escenarios) {
      const d = demora(e);
      if (d !== null) expect(d, nombre(e)).toBeGreaterThanOrEqual(300);
    }
  }, 30_000); // 108 escenarios de 14 s: con la máquina ocupada pasa de los 5 s de Vitest
});
