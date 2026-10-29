import { describe, expect, it } from "vitest";

import { similitud } from "./similitud-reglas";

describe("similitud", () => {
  it("es 1 para el mismo texto sin importar mayúsculas", () => {
    expect(similitud("Agrícola Chao", "agrícola chao")).toBe(1);
  });

  it("un apodo que comparte palabras se parece; uno distinto, casi nada", () => {
    expect(similitud("el de chao", "chao")).toBeGreaterThan(0.3);
    expect(similitud("el de chao", "piura")).toBeLessThan(0.1);
  });

  it("igual que pg_trgm: similarity('word', 'two words') es 4/11", () => {
    expect(similitud("word", "two words")).toBeCloseTo(4 / 11, 5);
  });
});
