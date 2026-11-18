import { describe, expect, it } from "vitest";

import type { ItemBorrador } from "./confirmar-venta-reglas";
import { avisosStock, faltaEnFila, recordatorioCompra } from "./stock-venta-reglas";

const mango = (cantidad: number): ItemBorrador => ({ productoId: 1, producto: "Mango Kent", cantidad, precio: 45, sugerido: false });
const palta = (cantidad: number): ItemBorrador => ({ productoId: 2, producto: "Palta Fuerte", cantidad, precio: 60, sugerido: false });
const stock = (pares: [number, number][]) => new Map(pares);

describe("avisosStock", () => {
  it("avisa si la venta pide más de lo que hay", () => {
    expect(avisosStock([mango(10)], stock([[1, 6]]))).toEqual([{ productoId: 1, producto: "Mango Kent", vendes: 10, quedan: 6 }]);
  });

  it("no avisa si alcanza justo o sobra", () => {
    expect(avisosStock([mango(6)], stock([[1, 6]]))).toEqual([]);
    expect(avisosStock([mango(4)], stock([[1, 6]]))).toEqual([]);
  });

  it("suma la misma fruta dictada dos veces", () => {
    expect(avisosStock([mango(4), mango(4)], stock([[1, 6]]))).toEqual([{ productoId: 1, producto: "Mango Kent", vendes: 8, quedan: 6 }]);
  });

  it("con dos frutas, avisa solo la que no alcanza, en el orden de la venta", () => {
    expect(avisosStock([mango(2), palta(5)], stock([[1, 6], [2, 3]]))).toEqual([{ productoId: 2, producto: "Palta Fuerte", vendes: 5, quedan: 3 }]);
  });

  it("media caja cuenta", () => {
    expect(avisosStock([mango(6.5)], stock([[1, 6]]))).toEqual([{ productoId: 1, producto: "Mango Kent", vendes: 6.5, quedan: 6 }]);
  });

  it("sin stock o en negativo, avisa", () => {
    expect(avisosStock([mango(1)], stock([[1, 0]]))).toHaveLength(1);
    expect(avisosStock([mango(1)], stock([[1, -4]]))).toHaveLength(1);
  });

  it("no avisa lo que no se sabe: una fruta sin elegir o sin su stock leído", () => {
    expect(avisosStock([{ ...mango(10), productoId: null }], stock([[1, 6]]))).toEqual([]);
    expect(avisosStock([mango(10)], stock([]))).toEqual([]);
  });
});

// formatearCajas une el número y «cajas» con un espacio duro, para que no se separen al saltar de renglón.
describe("faltaEnFila y el recordatorio", () => {
  const mango = { productoId: 1, producto: "Mango Kent", vendes: 10, quedan: 6 };
  const palta = { productoId: 2, producto: "Palta Fuerte", vendes: 3, quedan: -2 };

  it("la fila dice cuánto queda, corto para que quepa bajo el precio", () => {
    expect(faltaEnFila(mango)).toBe("Solo hay 6");
    expect(faltaEnFila({ ...mango, quedan: 1 })).toBe("Solo hay 1");
    expect(faltaEnFila({ ...mango, quedan: 2.5 })).toBe("Solo hay 2.5");
  });

  it("sin stock o en negativo, nunca una cifra imposible", () => {
    expect(faltaEnFila({ ...mango, quedan: 0 })).toBe("No te queda");
    expect(faltaEnFila(palta)).toBe("No te queda");
  });

  it("el recordatorio al guardar nombra la fruta y dónde anotar la compra", () => {
    expect(recordatorioCompra([])).toBeNull();
    expect(recordatorioCompra([mango])).toBe("Falta anotar la compra de Mango Kent: díctala o anótala en Stock.");
    expect(recordatorioCompra([mango, palta])).toBe("Falta anotar las compras de Mango Kent y Palta Fuerte: díctalas o anótalas en Stock.");
  });
});
