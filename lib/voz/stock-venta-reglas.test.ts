import { describe, expect, it } from "vitest";

import type { ItemBorrador } from "./confirmar-venta-reglas";
import { avisosStock, textoAviso } from "./stock-venta-reglas";

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
describe("textoAviso", () => {
  it("con stock: cuánto queda y cuánto vas a vender", () => {
    expect(textoAviso({ productoId: 1, producto: "Mango Kent", vendes: 10, quedan: 6 })).toBe("Según la app te quedan 6\u00a0cajas de Mango Kent y vas a vender 10.");
    expect(textoAviso({ productoId: 1, producto: "Mango Kent", vendes: 3, quedan: 1 })).toBe("Según la app te queda 1\u00a0caja de Mango Kent y vas a vender 3.");
    expect(textoAviso({ productoId: 1, producto: "Mango Kent", vendes: 6.5, quedan: 6 })).toBe("Según la app te quedan 6\u00a0cajas de Mango Kent y vas a vender 6.5.");
  });

  it("sin stock o en negativo, nunca una cifra imposible", () => {
    expect(textoAviso({ productoId: 1, producto: "Mango Kent", vendes: 2, quedan: 0 })).toBe("Según la app no te queda Mango Kent.");
    expect(textoAviso({ productoId: 1, producto: "Mango Kent", vendes: 2, quedan: -4 })).toBe("Según la app no te queda Mango Kent.");
  });
});
