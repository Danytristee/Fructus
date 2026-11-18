import { describe, expect, it } from "vitest";

import { CUADRO_MS, OIDO_NUEVO, SILENCIO_PARA_ENVIAR_MS, TOPE_HABLANDO_MS, VOZ_MINIMA_MS, nivelDb, oir, type Oido } from "./silencio-reglas";

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

  it("si el ruido suena tan fuerte como la voz, no «se calla»: no termina mientras suena (se envía con un toque o al tope)", () => {
    expect(escuchar([[FONDO, 300], [VOZ, 6000]]).fines).toEqual([]);
  });

  it("mientras habla, el fondo no sube: una frase larga no se corta sola antes del tope", () => {
    const { fines, oido } = escuchar([[FONDO, 300], [VOZ, 14_000]]);
    expect(fines).toEqual([]);
    expect(oido.fondo).toBeCloseTo(FONDO, 5);
  });

  describe("el tope: si nunca se calla, a los 15 s de empezar a hablar se envía igual", () => {
    it("con la bulla tan fuerte como la voz, termina a los 15 s de empezar a hablar", () => {
      expect(escuchar([[FONDO, 300], [VOZ, 20_000]]).fines).toEqual([300 + TOPE_HABLANDO_MS]);
    });

    it("cuenta desde que empezó a hablar, no desde que se abrió el micrófono: pensar antes de hablar no lo gasta", () => {
      expect(escuchar([[FONDO, 4000], [VOZ, 20_000]]).fines).toEqual([4000 + TOPE_HABLANDO_MS]);
    });

    it("una pausa para pensar no lo reinicia", () => {
      expect(escuchar([[FONDO, 300], [VOZ, 8000], [FONDO, 1000], [VOZ, 10_000]]).fines).toEqual([300 + TOPE_HABLANDO_MS]);
    });

    it("un golpe suelto no lo echa a andar", () => {
      expect(escuchar([[FONDO, 300], [VOZ, VOZ_MINIMA_MS - CUADRO_MS], [FONDO, 16_000]]).fines).toEqual([]);
    });
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

  describe("con bulla: cuenta solo la voz de quien dicta, no la de los vecinos", () => {
    const VECINOS = -38; // pregonan a un par de metros: más bajo que quien tiene el celular a un palmo
    const HUECO = -75; // entre grito y grito, con el supresor de ruido del celular, casi no suena nada
    const vecinos = (veces: number): [number, number][] => Array.from({ length: veces }, () => [[VECINOS, 300], [HUECO, 250]] as [number, number][]).flat();

    it("con vecinos que van y vienen, termina al callarse (antes, el fondo bajaba a los huecos y los vecinos contaban como voz: nunca)", () => {
      const { fines } = escuchar([...vecinos(2), [-20, 2000], ...vecinos(8)]);
      expect(fines).toEqual([1100 + 2000 + SILENCIO_PARA_ENVIAR_MS]);
    });

    it("la voz de un vecino, 15 dB más baja que la tuya, en el silencio después de hablar no vuelve a cero la cuenta", () => {
      const { fines } = escuchar([[FONDO, 300], [VOZ, 1500], [FONDO, 400], [VOZ - 15, 600], [FONDO, 1500]]);
      expect(fines).toEqual([300 + 1500 + SILENCIO_PARA_ENVIAR_MS]);
    });

    it("un vecino que grita 20 dB más fuerte a mitad de lo dictado no corta lo que sigue de la venta", () => {
      const { fines } = escuchar([[FONDO, 300], [VOZ, 1500], [VOZ + 20, 800], [VOZ, 1500], [FONDO, 3000]]);
      expect(fines).toEqual([300 + 1500 + 800 + 1500 + SILENCIO_PARA_ENVIAR_MS]);
    });

    it("si bajas la voz a mitad de frase, lo que sigue cuenta igual", () => {
      const { fines } = escuchar([[FONDO, 300], [-20, 1500], [-28, 1500], [FONDO, 3000]]);
      expect(fines).toEqual([300 + 3000 + SILENCIO_PARA_ENVIAR_MS]);
    });

    it("una jaba que cae (un golpe fuerte y corto) no se vuelve la voz", () => {
      const { fines } = escuchar([[FONDO, 300], [VOZ, 1000], [-5, 100], [VOZ, 1000], [FONDO, 3000]]);
      expect(fines).toEqual([300 + 2100 + SILENCIO_PARA_ENVIAR_MS]);
    });
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
