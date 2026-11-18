import { describe, expect, it } from "vitest";

import { MUESTRAS_POR_VENTANA, type DetectorVoz } from "./detector-voz";
import { crearFinDeHabla, sileroDelCuadro, type Aviso } from "./fin-de-habla";
import { SILENCIO_PARA_ENVIAR_MS } from "./silencio-reglas";

// La pieza que junta el audio del micrófono y decide con Silero o con el volumen. Aquí Silero es de mentira: dice lo que dice cada
// tramo (lo de verdad, con el modelo y audio de verdad, está en detector-voz.onnx.test.ts).

const FRECUENCIA = 16_000;
/** Lo que manda la captura del navegador cada vez: 80 ms (public/voz/captura-worklet.js). */
const TROZO = 1280;
const MS_POR_TROZO = (TROZO / FRECUENCIA) * 1000;

/** Un tramo: el volumen (dB), lo que diría Silero (de 0 a 1) y cuánto dura (ms). */
type Tramo = [db: number, silero: number, ms: number];

function audioDe(tramos: Tramo[]): Float32Array {
  const total = tramos.reduce((n, [, , ms]) => n + (ms * FRECUENCIA) / 1000, 0);
  const out = new Float32Array(total);
  let semilla = 3;
  let i = 0;
  for (const [db, , ms] of tramos) {
    const amplitud = 10 ** (db / 20) * Math.sqrt(3); // ruido parejo entre -a y a: su volumen es a/√3
    for (let j = 0; j < (ms * FRECUENCIA) / 1000; j++, i++) {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      out[i] = ((semilla / 2147483648) * 2 - 1) * amplitud;
    }
  }
  return out;
}

/** Un Silero de mentira que dice lo de cada tramo, ventana por ventana. `fallaEn`: en esa ventana se cae. */
function sileroDe(tramos: Tramo[], fallaEn = Infinity): DetectorVoz {
  let m = 0;
  return {
    oir: async () => {
      if (m >= fallaEn) throw new Error("se cayó");
      const t = ((m++ * MUESTRAS_POR_VENTANA + MUESTRAS_POR_VENTANA / 2) / FRECUENCIA) * 1000;
      let hasta = 0;
      for (const [, silero, ms] of tramos) if (t < (hasta += ms)) return silero;
      return 0;
    },
  };
}

/** Le pasa el audio en trozos de 80 ms, como el navegador, y anota en qué ms avisó que se calló. `sileroEnMs`: cuándo llega Silero. */
async function escuchar(tramos: Tramo[], { silero, sileroEnMs = 0 }: { silero?: DetectorVoz; sileroEnMs?: number } = {}) {
  const fin = crearFinDeHabla();
  const audio = audioDe(tramos);
  const callos: number[] = [];
  const avisos: Aviso[] = [];
  let conSilero = false;
  for (let i = 0; i + TROZO <= audio.length; i += TROZO) {
    const ms = ((i + TROZO) / FRECUENCIA) * 1000;
    if (silero && !conSilero && ms > sileroEnMs) {
      conSilero = true;
      avisos.push(await fin.conSilero(silero));
    }
    const a = await fin.oir(audio.slice(i, i + TROZO));
    avisos.push(a);
    if (a.callo) callos.push(ms);
  }
  return { callos, avisos };
}

describe("sileroDelCuadro", () => {
  it("un cuadro de 50 ms toma lo más alto de las ventanas de 32 ms que terminan dentro", () => {
    expect(sileroDelCuadro([0.1, 0.9, 0.3, 0.2], 0)).toBe(0.1); // termina la ventana 0 (a los 512)
    expect(sileroDelCuadro([0.1, 0.9, 0.3, 0.2], 1)).toBe(0.9); // terminan la 1 y la 2 (1024 y 1536)
  });

  it("si todavía no se oyeron sus ventanas, no hay qué decir", () => {
    expect(sileroDelCuadro([0.1, 0.9], 1)).toBeNull();
  });
});

describe("crearFinDeHabla", () => {
  const callado: Tramo = [-55, 0, 300];

  it("sin Silero decide el volumen: habló y calló, avisa a los 1.2 s", async () => {
    const { callos } = await escuchar([callado, [-25, 0.95, 1500], [-55, 0, 3000]]);
    expect(callos[0]).toBeGreaterThanOrEqual(1800 + SILENCIO_PARA_ENVIAR_MS);
    expect(callos[0]).toBeLessThan(1800 + SILENCIO_PARA_ENVIAR_MS + MS_POR_TROZO);
  });

  it("con Silero, un ruido fuerte que no es voz (un motor, una jaba) no cuenta como hablar", async () => {
    const tramos: Tramo[] = [callado, [-20, 0.02, 1500], [-55, 0, 3000]];
    const { callos, avisos } = await escuchar(tramos, { silero: sileroDe(tramos) });
    expect(callos).toEqual([]);
    expect(avisos.some((a) => a.hablo)).toBe(false);
    // El volumen solo sí lo habría tomado por voz.
    expect((await escuchar(tramos)).callos).toHaveLength(1);
  });

  it("con Silero, termina al callarse aunque el motor siga sonando tan fuerte como la voz (con el volumen solo, nunca)", async () => {
    const tramos: Tramo[] = [callado, [-25, 0.95, 1500], [-25, 0.02, 4000]];
    const { callos } = await escuchar(tramos, { silero: sileroDe(tramos) });
    expect(callos[0]).toBeGreaterThanOrEqual(1800 + SILENCIO_PARA_ENVIAR_MS);
    expect(callos[0]).toBeLessThan(1800 + SILENCIO_PARA_ENVIAR_MS + MS_POR_TROZO);
    expect((await escuchar(tramos)).callos).toEqual([]);
  });

  it("si Silero llega cuando ya estaba hablando, vuelve a oír desde el principio: lo dicho antes cuenta", async () => {
    const tramos: Tramo[] = [callado, [-25, 0.95, 1500], [-25, 0.02, 4000]];
    const { callos } = await escuchar(tramos, { silero: sileroDe(tramos), sileroEnMs: 1200 });
    expect(callos[0]).toBeGreaterThanOrEqual(1800 + SILENCIO_PARA_ENVIAR_MS);
    expect(callos[0]).toBeLessThan(1800 + SILENCIO_PARA_ENVIAR_MS + MS_POR_TROZO);
  });

  it("si Silero se cae a mitad, lo dice una vez y sigue el volumen, que oyó todo", async () => {
    const tramos: Tramo[] = [callado, [-25, 0.95, 1500], [-55, 0, 3000]];
    const { callos, avisos } = await escuchar(tramos, { silero: sileroDe(tramos, 20) });
    expect(avisos.filter((a) => a.fallo)).toHaveLength(1);
    expect(callos[0]).toBeGreaterThanOrEqual(1800 + SILENCIO_PARA_ENVIAR_MS);
    expect(callos[0]).toBeLessThan(1800 + SILENCIO_PARA_ENVIAR_MS + MS_POR_TROZO);
  });
});
