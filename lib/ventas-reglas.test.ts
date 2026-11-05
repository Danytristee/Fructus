import { describe, expect, it } from "vitest";

import { etiquetaDelPeriodo, fraseDePago, lineaDeFruta, resumirPeriodo } from "./ventas-reglas";

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

describe("resumirPeriodo", () => {
  it("suma lo cobrado y lo fiado, y el total es la suma de los dos", () => {
    expect(
      resumirPeriodo([
        { total: 450, credito: true },
        { total: 120.5, credito: false },
        { total: 80, credito: false },
      ]),
    ).toEqual({ ventas: 3, total: 650.5, contado: 200.5, credito: 450 });
  });

  it("suma en céntimos: el ruido de los decimales no inventa un céntimo", () => {
    const r = resumirPeriodo([
      { total: 0.1, credito: false },
      { total: 0.2, credito: false },
    ]);
    expect(r.contado).toBe(0.3);
    expect(r.total).toBe(0.3);
  });

  it("sin ventas, todo en cero", () => {
    expect(resumirPeriodo([])).toEqual({ ventas: 0, total: 0, contado: 0, credito: 0 });
  });
});

describe("fraseDePago", () => {
  it("al contado dice con qué pagó; al crédito, que lo debe", () => {
    expect(fraseDePago({ condicion: "contado", medio: "efectivo" })).toBe("Pagó en efectivo");
    expect(fraseDePago({ condicion: "contado", medio: "yape" })).toBe("Pagó con Yape");
    expect(fraseDePago({ condicion: "credito", medio: null })).toBe("Lo debe");
  });

  it("una venta al contado sin medio solo dice que pagó: no se inventa uno", () => {
    expect(fraseDePago({ condicion: "contado", medio: null })).toBe("Pagó");
  });
});

describe("lineaDeFruta", () => {
  it("dice cajas, fruta y precio como en el puesto", () => {
    expect(lineaDeFruta({ producto: "Mango Kent", cantidad: 10, precio: 45, descuento: 0, subtotal: 450 }, soles)).toEqual({
      titulo: "10 cajas de mango kent",
      detalle: "S/ 45.00 la caja",
    });
  });

  it("una caja va en singular, y la rebaja se dice", () => {
    expect(lineaDeFruta({ producto: "Papaya", cantidad: 1, precio: 35, descuento: 5, subtotal: 30 }, soles)).toEqual({
      titulo: "1 caja de papaya",
      detalle: "S/ 35.00 la caja, con S/ 5.00 de rebaja",
    });
  });

  it("media caja se lee con su decimal, como en el resto de la app (es-PE usa punto)", () => {
    expect(lineaDeFruta({ producto: "Uva", cantidad: 2.5, precio: 60, descuento: 0, subtotal: 150 }, soles).titulo).toBe("2.5 cajas de uva");
  });
});

describe("etiquetaDelPeriodo", () => {
  it("habla del período elegido", () => {
    expect(etiquetaDelPeriodo("hoy")).toBe("Hoy vendiste");
    expect(etiquetaDelPeriodo("semana")).toBe("En 7 días vendiste");
  });
});
