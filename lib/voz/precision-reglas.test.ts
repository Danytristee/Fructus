import { describe, expect, it } from "vitest";

import { camposPrudentes, diferencias, inventos, palabras, percentil } from "./precision-reglas";

describe("palabras", () => {
  it("normaliza tildes, mayúsculas y artículos", () => {
    expect(palabras("El de Chao")).toEqual(["chao"]);
    expect(palabras("Piña Golden")).toEqual(["pina", "golden"]);
    expect(palabras("la del puesto 12")).toEqual(["puesto", "12"]);
  });
});

describe("diferencias", () => {
  const esperado = { cliente_texto: "don lucho", items: [{ producto_texto: "mango kent", cantidad: 10, precio_unitario: null }], condicion: "credito" };

  it("acepta un texto que dice lo esperado con otras palabras alrededor", () => {
    expect(diferencias(esperado, { cliente_texto: "Don Lucho", items: [{ producto_texto: "Mango Kent", cantidad: 10, precio_unitario: null }], condicion: "credito", dudas: [] })).toEqual([]);
  });

  it("dice qué campo falló", () => {
    expect(diferencias(esperado, { cliente_texto: "Lucho", items: [{ producto_texto: "mango kent", cantidad: 8, precio_unitario: null }], condicion: "credito" })).toEqual([
      "cliente_texto: esperaba «don lucho», vino \"Lucho\"",
      "items[0].cantidad: esperaba 10, vino 8",
    ]);
  });
});

describe("inventos", () => {
  it("un precio o una condición que debían ser null y vinieron con valor son inventos", () => {
    const esperado = { items: [{ precio_unitario: null }], condicion: null, medio_pago: null };
    expect(inventos(esperado, { items: [{ precio_unitario: 45 }], condicion: "contado", medio_pago: null })).toEqual([
      "items[0].precio_unitario = 45",
      "condicion = \"contado\"",
    ]);
    expect(camposPrudentes(esperado)).toBe(3);
  });
});

describe("percentil", () => {
  it("p50 y p95", () => {
    expect(percentil([100, 200, 300, 400], 50)).toBe(200);
    expect(percentil([100, 200, 300, 400], 95)).toBe(400);
  });
});
