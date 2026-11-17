import { describe, expect, it } from "vitest";

import { esperaDelPaso } from "./paso-reglas";

describe("esperaDelPaso", () => {
  it("antes de repetir espera lo bastante para que un toque sea un solo paso", () => {
    expect(esperaDelPaso(0)).toBeGreaterThanOrEqual(400);
  });

  it("después repite, y a los pocos pasos va más rápido", () => {
    expect(esperaDelPaso(1)).toBeLessThan(esperaDelPaso(0));
    expect(esperaDelPaso(6)).toBeLessThan(esperaDelPaso(5));
    expect(esperaDelPaso(50)).toBe(esperaDelPaso(6));
  });

  it("de 10 a 30 cajas manteniendo apretado tarda menos de 2 segundos", () => {
    let total = 0;
    for (let n = 0; n < 20; n++) total += esperaDelPaso(n);
    expect(total).toBeLessThan(2000);
  });
});
