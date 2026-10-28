import { describe, expect, it } from "vitest";
import { formatearCajas, formatearSoles } from "./formato";

describe("formatearSoles", () => {
  it("escribe soles con separador de miles y dos decimales", () => {
    expect(formatearSoles(1250)).toBe("S/ 1,250.00");
    expect(formatearSoles(3215.5)).toBe("S/ 3,215.50");
  });
  it("no pierde el cero", () => {
    expect(formatearSoles(0)).toBe("S/ 0.00");
  });
});

describe("formatearCajas", () => {
  it("usa singular para una caja", () => {
    expect(formatearCajas(1)).toBe("1 caja");
  });
  it("usa plural para el resto, con decimales si los hay", () => {
    expect(formatearCajas(10)).toBe("10 cajas");
    expect(formatearCajas(2.5)).toBe("2.5 cajas");
  });
});
