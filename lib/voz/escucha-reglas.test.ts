import { describe, expect, test } from "vitest";

import { CUADROS_PREVIOS, ESPERA_VOZ_MS, empezarDictado, estadoDeEscucha, muestrasDe, seguirDictado, type Dictado } from "./escucha-reglas";

const base = { activa: true, visible: true, hojaAbierta: false, voz: "listo" as const, porPalabra: false };

describe("cuándo se escucha «Hola Fructus»", () => {
  test("con el interruptor prendido y «Hoy» a la vista, atenta", () => {
    expect(estadoDeEscucha(base)).toBe("atenta");
  });

  test("con el interruptor apagado, nada; con la pantalla oculta, suelta el micrófono", () => {
    expect(estadoDeEscucha({ ...base, activa: false })).toBe("apagada");
    expect(estadoDeEscucha({ ...base, activa: false, visible: false })).toBe("apagada");
    expect(estadoDeEscucha({ ...base, visible: false })).toBe("dormida");
  });

  test("con la tarjeta abierta o mientras entiende, no busca la frase", () => {
    expect(estadoDeEscucha({ ...base, hojaAbierta: true })).toBe("pausada");
    expect(estadoDeEscucha({ ...base, voz: "entendiendo" })).toBe("pausada");
  });

  test("grabando con el dedo no busca la frase; grabando lo que siguió a «Hola Fructus», sigue atenta", () => {
    expect(estadoDeEscucha({ ...base, voz: "escuchando" })).toBe("pausada");
    expect(estadoDeEscucha({ ...base, voz: "escuchando", porPalabra: true })).toBe("atenta");
  });
});

// Cuadros de 80 ms: voz (un tono fuerte) o silencio (un soplo).
const voz = () => Int16Array.from({ length: 1280 }, (_, i) => Math.round(Math.sin(i / 3) * 12_000));
const silencio = () => Int16Array.from({ length: 1280 }, (_, i) => (i % 2 ? 3 : -3));

/** Pasa los cuadros por el dictado; devuelve en qué cuadro (desde 1) avisó que calló o que no habló. */
function dictar(cuadros: Int16Array[], d: Dictado = empezarDictado([])) {
  let callo: number | null = null;
  let mudo: number | null = null;
  cuadros.forEach((c, i) => {
    const r = seguirDictado(d, c);
    d = r.dictado;
    if (r.callo && callo === null) callo = i + 1;
    if (r.mudo && mudo === null) mudo = i + 1;
  });
  return { d, callo, mudo };
}

describe("el dictado que sigue a «Hola Fructus»", () => {
  test("guarda los 2 s de antes de despertar: la frase entera, para que Whisper la confirme", () => {
    expect(CUADROS_PREVIOS).toBe(25);
    const previos = Array.from({ length: 25 }, voz);
    const { d } = dictar([voz()], empezarDictado(previos));
    expect(d.cuadros).toHaveLength(26);
    expect(muestrasDe(d)).toHaveLength(26 * 1280);
    expect(muestrasDe(d).subarray(0, 1280)).toEqual(previos[0]);
  });

  test("dicho de corrido, habla dos segundos y calla: avisa al cumplir 1.2 s de silencio", () => {
    const { callo, mudo } = dictar([...Array.from({ length: 25 }, voz), ...Array.from({ length: 20 }, silencio)]);
    // 25 cuadros de voz (2 s) y 1.2 s de silencio, 15 cuadros más: avisa en el 40, o en el siguiente por el redondeo de 50 ms.
    expect(callo).toBeGreaterThanOrEqual(40);
    expect(callo).toBeLessThanOrEqual(41);
    expect(mudo).toBeNull();
  });

  test("«Hola Fructus», una pausa larga esperando el tin y después la orden: no envía la frase sola, envía al terminar la orden", () => {
    const cola = Array.from({ length: 5 }, voz); // los últimos 400 ms de «…tus»
    const pausa = Array.from({ length: 25 }, silencio); // 2 s pensando
    const orden = Array.from({ length: 15 }, voz); // «vendí diez cajas…»
    const { callo, mudo } = dictar([...cola, ...pausa, ...orden, ...Array.from({ length: 20 }, silencio)]);
    expect(callo).toBeGreaterThanOrEqual(5 + 25 + 15 + 15);
    expect(callo).toBeLessThanOrEqual(5 + 25 + 15 + 16);
    expect(mudo).toBeNull();
  });

  test("lo de antes de despertar no cuenta como voz: callarse después de «Hola Fructus» no envía la frase sola", () => {
    const previos = Array.from({ length: 25 }, voz);
    const { callo } = dictar(Array.from({ length: 30 }, silencio), empezarDictado(previos));
    expect(callo).toBeNull();
  });

  test("el final de «…tus», que cae justo después de despertar, no cuenta como hablar: si después calla, es mudo", () => {
    const cola = [voz(), voz()]; // 160 ms de voz: el final de la frase, no una orden
    const { mudo, callo } = dictar([...cola, ...Array.from({ length: 70 }, silencio)]);
    expect(mudo).toBe(63);
    expect(callo).toBeNull();
  });

  test("si no dice nada en 5 s, no era para Fructus", () => {
    const cuadros = Math.ceil(ESPERA_VOZ_MS / 80);
    const { mudo, callo } = dictar(Array.from({ length: cuadros + 2 }, silencio));
    expect(mudo).toBe(cuadros);
    expect(callo).toBeNull();
  });

  test("si empieza a hablar antes de los 5 s, no es mudo aunque tarde en terminar", () => {
    const { mudo: hablando } = dictar([...Array.from({ length: 40 }, silencio), ...Array.from({ length: 40 }, voz)]);
    expect(hablando).toBeNull(); // empezó a los 3.2 s
    const { mudo } = dictar([...Array.from({ length: 70 }, silencio), ...Array.from({ length: 10 }, voz)]);
    expect(mudo).toBe(63); // a los 5 s seguía callado: eso sí avisa, aunque después hable
  });
});
