import { describe, expect, it } from "vitest";

import { frutaIlustrada } from "./frutas";
import { deAbono, deCompra, deGasto, deMerma, deVenta, describirItems, iniciales, tonoDe, ultimas } from "./operaciones-reglas";

const mango = { nombre: "Mango", variedad: "Kent" };
const pina = { nombre: "Piña", variedad: "golden" };
const uva = { nombre: "Uva", variedad: "red globe" };

describe("iniciales", () => {
  it("toma las dos primeras palabras que importan", () => {
    expect(iniciales("Juguería El Paraíso")).toBe("JP");
    expect(iniciales("Rosa Quispe")).toBe("RQ");
    expect(iniciales("Bodega Santa Ana")).toBe("BS");
  });
});

describe("tonoDe", () => {
  it("la misma persona tiene siempre el mismo color, dentro de 0–359", () => {
    expect(tonoDe(3)).toBe(tonoDe(3));
    expect(tonoDe(1)).not.toBe(tonoDe(2));
    expect(tonoDe(1000)).toBeLessThan(360);
  });
});

describe("describirItems", () => {
  it("dos selecciones o dos calibres de la misma fruta no se confunden en la frase", () => {
    const tercera = { nombre: "Membrillo", variedad: null, seleccion: "3era" };
    const cuarta = { nombre: "Membrillo", variedad: null, seleccion: "4ta" };
    expect(describirItems([{ cantidad: 2, producto: tercera }, { cantidad: 1, producto: cuarta }])).toBe("2 de membrillo 3era y 1 de membrillo 4ta");
    const roja = { nombre: "Manzana", variedad: "Roja americana", seleccion: "Premium", calibre: "100" };
    expect(describirItems([{ cantidad: 3, producto: roja }]).replace(/\u00a0/g, " ")).toBe("3 de manzana roja americana premium cal. 100");
  });

  it("cuenta en lenguaje de puesto", () => {
    expect(describirItems([{ cantidad: 10, producto: mango }])).toBe("10 de mango kent");
    expect(describirItems([{ cantidad: 5, producto: mango }, { cantidad: 3, producto: pina }])).toBe("5 de mango kent y 3 de piña golden");
    expect(describirItems([{ cantidad: 4, producto: mango }, { cantidad: 2, producto: uva }, { cantidad: 1, producto: pina }])).toBe(
      "4 de mango kent, 2 de uva red globe y 1 más",
    );
  });
});

describe("frutaIlustrada", () => {
  it("encuentra la ilustración sin importar tildes ni mayúsculas", () => {
    expect(frutaIlustrada("Piña")).toBe("pina");
    expect(frutaIlustrada("LIMÓN")).toBe("limon");
    expect(frutaIlustrada("Palta fuerte")).toBe("palta");
    expect(frutaIlustrada("Papaya")).toBe("papaya");
  });
  it("distingue la variedad cuando cambia cómo se ve", () => {
    expect(frutaIlustrada("Mango Edward")).toBe("mango-edward");
    expect(frutaIlustrada("mango kent")).toBe("mango-kent");
    expect(frutaIlustrada("Plátano de isla")).toBe("platano-isla");
    expect(frutaIlustrada("Plátano isla")).toBe("platano-isla");
    expect(frutaIlustrada("Plátano de seda")).toBe("platano-seda");
  });
  it("sin variedad, el mango es Kent y el plátano es de seda (lo más común en el mercado)", () => {
    expect(frutaIlustrada("Mango")).toBe("mango-kent");
    expect(frutaIlustrada("Plátano")).toBe("platano-seda");
  });
  it("la mandarina tiene su dibujo; el tangelo usa el de la naranja; lo que no está, nada", () => {
    expect(frutaIlustrada("Mandarina")).toBe("mandarina");
    expect(frutaIlustrada("Tangelo")).toBe("naranja");
    expect(frutaIlustrada("Granadilla")).toBeNull();
  });
});

describe("cada operación en una línea", () => {
  it("una venta al crédito dice quién y que lo debe", () => {
    const op = deVenta({ id: 7, fecha: "2026-10-28T15:00:00Z", total: 450, condicion: "credito", medio: null, cliente: { id: 1, nombre: "Luis Paredes" }, items: [{ cantidad: 10, producto: mango }] });
    expect(op).toMatchObject({ titulo: "Luis Paredes", detalle: "10 de mango kent", monto: 450, estado: "debe", fruta: "mango-kent" });
    expect(op.persona?.iniciales).toBe("LP");
  });

  it("una venta al contado sin cliente es «al paso» y dice cómo pagó", () => {
    const op = deVenta({ id: 8, fecha: "2026-10-28T15:00:00Z", total: 180, condicion: "contado", medio: "yape", cliente: null, items: [{ cantidad: 6, producto: pina }] });
    expect(op).toMatchObject({ titulo: "Venta al paso", detalle: "6 de piña golden, con Yape", estado: "pago", persona: null, fruta: "pina" });
  });

  it("un abono, una compra, una merma y un gasto", () => {
    expect(deAbono({ id: 1, fecha: "x", monto: 200, medio: "efectivo", cliente: { id: 2, nombre: "Rosa Quispe" } })).toMatchObject({
      titulo: "Rosa Quispe",
      detalle: "Abonó en efectivo",
      estado: "abono",
    });
    expect(deCompra({ id: 1, fecha: "x", total: 1200, proveedor: { nombre: "Agrícola Chao" }, items: [{ cantidad: 40, producto: mango }] })).toMatchObject({
      titulo: "Agrícola Chao",
      detalle: "Compraste 40 de mango kent",
      estado: "compra",
    });
    expect(deMerma({ id: 1, fecha: "x", cantidad: -2, motivo: "se malogró", producto: { nombre: "Papaya", variedad: null } })).toMatchObject({
      titulo: "Merma",
      detalle: "2 de papaya, se malogró",
      monto: null,
      estado: "merma",
    });
    expect(deGasto({ id: 1, fecha: "x", monto: 40, categoria: "flete", descripcion: "Flete del mercado" })).toMatchObject({
      titulo: "Flete del mercado",
      detalle: "Gasto de flete",
      estado: "gasto",
    });
  });
});

describe("ultimas", () => {
  it("ordena de la más reciente a la más antigua y se queda con 5", () => {
    const ops = [1, 5, 3, 6, 2, 4].map((h) => deGasto({ id: h, fecha: `2026-10-28T1${h}:00:00Z`, monto: h, categoria: "otros", descripcion: null }));
    expect(ultimas(ops).map((o) => o.monto)).toEqual([6, 5, 4, 3, 2]);
  });
});
