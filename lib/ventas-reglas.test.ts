import { describe, expect, it } from "vitest";

import { etiquetaDelPeriodo, fraseDePago, lineaDeFruta, resumirPeriodo, resumirVentas, type FilaDeVenta } from "./ventas-reglas";

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

describe("resumirPeriodo", () => {
  it("suma lo cobrado y lo fiado, y el total es la suma de los dos", () => {
    expect(
      resumirPeriodo([
        { total: 450, credito: true },
        { total: 120.5, credito: false },
        { total: 80, credito: false },
      ]),
    ).toEqual({ ventas: 3, total: 650.5, contado: 200.5, credito: 450, ventasContado: 2, ventasCredito: 1 });
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
    expect(resumirPeriodo([])).toEqual({ ventas: 0, total: 0, contado: 0, credito: 0, ventasContado: 0, ventasCredito: 0 });
  });
});

// El historial muestra a lo sumo las últimas 300 ventas, pero los totales de arriba tienen que contar TODAS las del período: si no,
// «En 7 días vendiste» sale bajo sin avisar cuando el puesto vende más de unas 43 al día.
describe("resumirVentas", () => {
  const dia = (iso: string) => iso.slice(0, 10); // en la prueba, el día es la fecha tal cual
  const venta = (fecha: string, total: number, condicion: "contado" | "credito", estado = "registrada"): FilaDeVenta => ({ fecha, total, condicion, estado });

  it("separa «hoy» de «7 días» (los 7 días incluyen hoy) y cada período suma contado y crédito", () => {
    const r = resumirVentas(
      [
        venta("2026-11-05T14:00:00Z", 450, "credito"),
        venta("2026-11-05T15:00:00Z", 120.5, "contado"),
        venta("2026-11-04T10:00:00Z", 80, "contado"),
        venta("2026-10-30T10:00:00Z", 300, "credito"),
      ],
      "2026-11-05",
      dia,
    );
    expect(r.resumenes.hoy).toEqual({ ventas: 2, total: 570.5, contado: 120.5, credito: 450, ventasContado: 1, ventasCredito: 1 });
    expect(r.resumenes.semana).toEqual({ ventas: 4, total: 950.5, contado: 200.5, credito: 750, ventasContado: 2, ventasCredito: 2 });
  });

  it("cada día trae lo suyo: cuántas ventas, cuántas anuladas y cuánto, para la cabecera del día (aunque la lista se corte)", () => {
    const r = resumirVentas(
      [
        venta("2026-11-05T14:00:00Z", 450, "credito"),
        venta("2026-11-05T15:00:00Z", 120.5, "contado"),
        venta("2026-11-05T16:00:00Z", 999, "contado", "anulada"),
        venta("2026-11-04T10:00:00Z", 80, "contado"),
      ],
      "2026-11-05",
      dia,
    );
    expect(r.porDia).toEqual({
      "2026-11-05": { ventas: 2, anuladas: 1, total: 570.5 },
      "2026-11-04": { ventas: 1, anuladas: 0, total: 80 },
    });
  });

  it("una venta anulada no suma dinero ni se cuenta como venta, pero sí está en la lista de filas", () => {
    const r = resumirVentas([venta("2026-11-05T14:00:00Z", 450, "contado"), venta("2026-11-05T15:00:00Z", 999, "contado", "anulada")], "2026-11-05", dia);
    expect(r.resumenes.hoy.total).toBe(450);
    expect(r.resumenes.hoy.ventas).toBe(1);
    expect(r.filas).toEqual({ hoy: 2, semana: 2 });
  });

  it("cuenta más de 300 ventas sin cortarlas (el límite es de la lista, no de los totales)", () => {
    const muchas = Array.from({ length: 420 }, (_, i) => venta(`2026-11-0${1 + (i % 5)}T10:00:00Z`, 10, i % 3 === 0 ? "credito" : "contado"));
    const r = resumirVentas(muchas, "2026-11-05", dia);
    expect(r.resumenes.semana.ventas).toBe(420);
    expect(r.resumenes.semana.total).toBe(4200);
    expect(r.filas.semana).toBe(420);
  });

  it("sin ventas, todo en cero", () => {
    const cero = { ventas: 0, total: 0, contado: 0, credito: 0, ventasContado: 0, ventasCredito: 0 };
    expect(resumirVentas([], "2026-11-05", dia)).toEqual({ resumenes: { hoy: cero, semana: cero }, filas: { hoy: 0, semana: 0 }, porDia: {} });
  });

  it("suma en céntimos, como la base", () => {
    const r = resumirVentas([venta("2026-11-05T10:00:00Z", 0.1, "contado"), venta("2026-11-05T11:00:00Z", 0.2, "contado")], "2026-11-05", dia);
    expect(r.resumenes.hoy.total).toBe(0.3);
  });
});

describe("fraseDePago", () => {
  it("al contado dice con qué pagó; al crédito, que lo debe", () => {
    expect(fraseDePago({ condicion: "contado", medio: "efectivo" })).toBe("Pagó en efectivo");
    expect(fraseDePago({ condicion: "contado", medio: "yape" })).toBe("Pagó con Yape");
    expect(fraseDePago({ condicion: "credito", medio: null })).toBe("Lo debe");
  });

  it("al crédito con pago al llevar, debe el resto (ADR-0023)", () => {
    expect(fraseDePago({ condicion: "credito", medio: null, pagoAlLlevar: { monto: 1000, medio: "efectivo" } })).toBe("Debe el resto");
    expect(fraseDePago({ condicion: "credito", medio: null, pagoAlLlevar: null })).toBe("Lo debe");
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
