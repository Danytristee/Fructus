import { describe, expect, it } from "vitest";

import { LIBRE, MANTENER_MS, TOLERANCIA_PX, siguienteToque, type EventoToque, type Toque } from "./toque-reglas";

/** Corre una serie de eventos desde LIBRE y dice si alguno calló la voz. */
function calla(eventos: EventoToque[]): boolean {
  let t: Toque = LIBRE;
  let callo = false;
  for (const e of eventos) {
    const r = siguienteToque(t, e);
    t = r.toque;
    callo ||= r.calla;
  }
  return callo;
}

const bajar = (x = 100, y = 400): EventoToque => ({ tipo: "bajar", x, y });
const mover = (x: number, y: number): EventoToque => ({ tipo: "mover", x, y });

describe("tocar la tarjeta calla la voz; deslizarla para leer, no", () => {
  it("bajar el dedo todavía no calla: puede ser el principio de un deslizamiento", () => {
    expect(calla([bajar()])).toBe(false);
  });

  it("un toque calla: el clic que sigue a soltar el dedo", () => {
    expect(calla([bajar(), { tipo: "soltar" }, { tipo: "clic" }])).toBe(true);
  });

  it("un toque con el dedo que tiembla un poco sigue siendo toque", () => {
    expect(calla([bajar(), mover(104, 395), { tipo: "soltar" }, { tipo: "clic" }])).toBe(true);
  });

  it("deslizar para leer no calla, ni cuando el navegador se queda con el gesto", () => {
    expect(calla([bajar(), mover(100, 380), mover(100, 250), { tipo: "perder" }])).toBe(false);
    expect(calla([bajar(), mover(100, 380), mover(100, 250), { tipo: "soltar" }])).toBe(false);
  });

  it("el dedo que ya deslizó no calla aunque se quede quieto después", () => {
    expect(calla([bajar(), mover(100, 400 - TOLERANCIA_PX - 1), { tipo: "quieto" }])).toBe(false);
  });

  it("dejar el dedo quieto (mantener «+») calla, aunque todavía no se suelte", () => {
    expect(calla([bajar(), { tipo: "quieto" }])).toBe(true);
    expect(calla([bajar(), mover(100 + TOLERANCIA_PX, 400), { tipo: "quieto" }])).toBe(true);
  });

  it("el reloj de mantener no calla si el dedo ya se levantó", () => {
    expect(calla([bajar(), { tipo: "soltar" }, { tipo: "quieto" }])).toBe(false);
  });

  it("Enter o Espacio con el teclado también calla: llegan como clic, sin dedo", () => {
    expect(calla([{ tipo: "clic" }])).toBe(true);
  });

  it("espera lo mismo que «+» antes de repetir: mantenerlo calla justo cuando empieza a sumar", () => {
    expect(MANTENER_MS).toBe(450);
  });
});
