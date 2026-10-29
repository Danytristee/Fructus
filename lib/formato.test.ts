import { describe, expect, it } from "vitest";
import { diaDeLima, formatearCajas, formatearFecha, formatearHace, formatearHora, formatearSoles } from "./formato";

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

describe("formatearHora", () => {
  it("dice mañana, mediodía y tarde como en el puesto", () => {
    expect(formatearHora(6)).toBe("6 a. m.");
    expect(formatearHora(12)).toBe("12 m.");
    expect(formatearHora(15)).toBe("3 p. m.");
    expect(formatearHora(0)).toBe("12 a. m.");
  });
});

describe("formatearHace y diaDeLima", () => {
  const ahora = new Date("2026-10-28T15:00:00Z"); // 10 a. m. en Lima
  it("cuenta días de Lima, no horas", () => {
    expect(formatearHace(new Date("2026-10-28T13:00:00Z"), ahora)).toBe("hoy");
    expect(formatearHace(new Date("2026-10-28T04:00:00Z"), ahora)).toBe("ayer"); // 11 p. m. del 27 en Lima
    expect(formatearHace(new Date("2026-10-25T15:00:00Z"), ahora)).toBe("hace 3 días");
  });
  it("agrupa por el día de Lima", () => {
    expect(diaDeLima(new Date("2026-10-29T03:00:00Z"))).toBe("2026-10-28");
  });
});
