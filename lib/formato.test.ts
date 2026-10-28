import { describe, expect, it } from "vitest";
import { formatearCajas, formatearFecha, formatearSoles } from "./formato";

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

describe("formatearFecha", () => {
  it("escribe el día como se dice en el puesto", () => {
    expect(formatearFecha(new Date("2026-10-28T15:00:00Z"))).toBe("miércoles 28 de octubre");
  });
  it("usa la hora de Lima: a las 11 p. m. de Lima ya es mañana en UTC, pero sigue siendo hoy", () => {
    expect(formatearFecha(new Date("2026-10-29T04:00:00Z"))).toBe("miércoles 28 de octubre");
  });
});
