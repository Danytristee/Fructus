import { describe, expect, it } from "vitest";

import { leerMonto, montoValido } from "./monto-reglas";

const monto = (texto: string) => leerMonto(texto, { nombre: "monto", maximo: 100_000 });

describe("leerMonto", () => {
  it("lee 45, 47.50, 47,5 y S/ 45", () => {
    expect(monto("45")).toEqual({ ok: true, valor: 45 });
    expect(monto("47.50")).toEqual({ ok: true, valor: 47.5 });
    expect(monto("47,5")).toEqual({ ok: true, valor: 47.5 });
    expect(monto("S/ 45")).toEqual({ ok: true, valor: 45 });
    expect(monto("s/45")).toEqual({ ok: true, valor: 45 });
    expect(monto("  40  ")).toEqual({ ok: true, valor: 40 });
  });

  it("el «S/» solo se quita al principio: en el medio no es un monto (/chaos 2026-11-05)", () => {
    // «4s/0» se leía como 40: el texto dice una cosa y se guardaba otra.
    expect(monto("4s/0")).toEqual({ ok: false, error: "Escribe el monto así: 45 o 47.50." });
    expect(monto("10S/5")).toEqual({ ok: false, error: "Escribe el monto así: 45 o 47.50." });
    expect(monto("45s/")).toEqual({ ok: false, error: "Escribe el monto así: 45 o 47.50." });
    expect(monto("S/S/40")).toEqual({ ok: false, error: "Escribe el monto así: 45 o 47.50." });
  });

  it("nunca adivina: «1,299» y «1.299» no son 1299 ni 1.299", () => {
    for (const texto of ["1,299", "1.299", "1,299.50", "10.123"]) {
      expect(monto(texto), texto).toEqual({ ok: false, error: "Escribe el monto así: 45 o 47.50." });
    }
  });

  it("rechaza lo que no es un monto, con la razón", () => {
    expect(monto("")).toEqual({ ok: false, error: null });
    expect(monto("-5")).toEqual({ ok: false, error: "El monto no puede ser negativo." });
    expect(monto("0")).toEqual({ ok: false, error: "El monto tiene que ser más que cero." });
    expect(monto("100000.01")).toMatchObject({ ok: false });
    expect(monto("abc")).toMatchObject({ ok: false });
    expect(monto("1234567890")).toMatchObject({ ok: false });
  });
});

describe("montoValido", () => {
  it("más que cero, hasta el tope y con dos decimales como máximo", () => {
    expect(montoValido(40, 100)).toBe(true);
    expect(montoValido(0, 100)).toBe(false);
    expect(montoValido(null, 100)).toBe(false);
    expect(montoValido(101, 100)).toBe(false);
    expect(montoValido(1.234, 100)).toBe(false);
  });
});
