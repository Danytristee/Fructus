import { describe, expect, it } from "vitest";

import { CUADRO_MS, OIDO_NUEVO, SILENCIO_PARA_ENVIAR_MS, VOZ_MINIMA_MS, nivelDb, oir, type Oido } from "./silencio-reglas";

/** Tramos de [nivel en dB, ms]. Devuelve en qué ms terminó cada vez (desde el primer cuadro). */
function escuchar(tramos: [number, number][], desde: Oido = OIDO_NUEVO) {
  let o = desde;
  let t = 0;
  const fines: number[] = [];
  for (const [nivel, ms] of tramos) {
    for (let i = 0; i < ms / CUADRO_MS; i++) {
      t += CUADRO_MS;
      const r = oir(o, nivel);
      o = r.oido;
      if (r.termino) fines.push(t);
    }
  }
  return { fines, oido: o };
}

const FONDO = -55; // un puesto tranquilo con el audífono
const VOZ = -25;

describe("oir", () => {
  it("habló y calló SILENCIO_PARA_ENVIAR_MS: termina justo ahí, ni un cuadro antes", () => {
    const { fines } = escuchar([[FONDO, 500], [VOZ, 1500], [FONDO, 3000]]);
    expect(fines).toEqual([500 + 1500 + SILENCIO_PARA_ENVIAR_MS]);
  });

  it("una pausa para pensar el precio no envía", () => {
    const { fines } = escuchar([[FONDO, 300], [VOZ, 1000], [FONDO, 1000], [VOZ, 800], [FONDO, 1100]]);
    expect(fines).toEqual([]);
  });

  it("si nunca habló, el silencio no envía nada", () => {
    expect(escuchar([[FONDO, 10_000]]).fines).toEqual([]);
  });

  it("un golpe o una tos sueltos no alcanzan para enviar", () => {
    expect(escuchar([[FONDO, 300], [VOZ, VOZ_MINIMA_MS - CUADRO_MS], [FONDO, 3000]]).fines).toEqual([]);
    expect(escuchar([[FONDO, 300], [VOZ, VOZ_MINIMA_MS], [FONDO, 3000]]).fines).toHaveLength(1);
  });

  it("con el puesto ruidoso, la voz por encima del ruido también cuenta", () => {
    const { fines } = escuchar([[-38, 500], [-20, 1500], [-38, 2000]]);
    expect(fines).toEqual([500 + 1500 + SILENCIO_PARA_ENVIAR_MS]);
  });

  it("un ruido que crece despacio (un motor que arranca) no se vuelve voz", () => {
    const tramos: [number, number][] = Array.from({ length: 100 }, (_, i) => [FONDO + i * 0.1, 100]); // +1 dB por segundo, 10 s
    expect(escuchar(tramos).fines).toEqual([]);
  });

  it("si el ruido suena tan fuerte como la voz, nunca «se calla»: se envía con un toque", () => {
    expect(escuchar([[FONDO, 300], [VOZ, 6000]]).fines).toEqual([]);
  });

  it("mientras habla, el fondo no sube: una frase larga no se corta sola", () => {
    const { fines, oido } = escuchar([[FONDO, 300], [VOZ, 20_000]]);
    expect(fines).toEqual([]);
    expect(oido.fondo).toBeCloseTo(FONDO, 5);
  });

  it("después de terminar vuelve a empezar: si no se envió (el dedo seguía encima), avisa otra vez al callarse de nuevo", () => {
    const { fines } = escuchar([[FONDO, 300], [VOZ, 1000], [FONDO, 1500], [VOZ, 1000], [FONDO, 1500]]);
    expect(fines).toEqual([300 + 1000 + SILENCIO_PARA_ENVIAR_MS, 300 + 1000 + 1500 + 1000 + SILENCIO_PARA_ENVIAR_MS]);
  });

  it("una respuesta de una palabra se cierra con menos silencio", () => {
    let o = OIDO_NUEVO;
    const fines: number[] = [];
    let t = 0;
    for (const [nivel, ms] of [[FONDO, 300], [VOZ, 600], [FONDO, 2000]] as const) {
      for (let i = 0; i < ms / CUADRO_MS; i++) {
        t += CUADRO_MS;
        const r = oir(o, nivel, 800);
        o = r.oido;
        if (r.termino) fines.push(t);
      }
    }
    expect(fines).toEqual([300 + 600 + 800]);
  });

  it("si responde apenas se abre el micrófono (el primer cuadro ya es voz), lo dicho cuenta igual y termina al callarse", () => {
    expect(escuchar([[VOZ, 700], [FONDO, 3000]]).fines).toEqual([700 + SILENCIO_PARA_ENVIAR_MS]);
    expect(escuchar([[-13, 700], [-100, 3000]]).fines).toEqual([700 + SILENCIO_PARA_ENVIAR_MS]);
  });

  it("y no corta antes: el silencio se cuenta recién desde que dejó de hablar", () => {
    // Habla desde el primer cuadro, respira 300 ms y sigue: no termina en la respiración.
    expect(escuchar([[VOZ, 800], [FONDO, 300], [VOZ, 800], [FONDO, 3000]]).fines).toEqual([800 + 300 + 800 + SILENCIO_PARA_ENVIAR_MS]);
  });

  it("el silencio digital (-∞) no rompe nada", () => {
    const { fines } = escuchar([[-Infinity, 300], [VOZ, 1000], [-Infinity, 1500]]);
    expect(fines).toEqual([300 + 1000 + SILENCIO_PARA_ENVIAR_MS]);
  });
});

describe("nivelDb", () => {
  it("un trozo mudo o vacío es el piso", () => {
    expect(nivelDb(new Float32Array(1024))).toBe(-100);
    expect(nivelDb([])).toBe(-100);
  });

  it("una onda de amplitud 0.5 suena a unos -9 dB", () => {
    const onda = Float32Array.from({ length: 1000 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * i) / 50));
    expect(nivelDb(onda)).toBeCloseTo(-9.03, 1);
  });
});
