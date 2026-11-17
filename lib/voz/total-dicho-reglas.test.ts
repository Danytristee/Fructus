import { describe, expect, it } from "vitest";

import { dijoA, precioQueEraTotal } from "./total-dicho-reglas";

describe("dijoA", () => {
  it("«a N» después de la fruta, con o sin soles, con miles o céntimos", () => {
    expect(dijoA("Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000", 500)).toBe(true);
    expect(dijoA("Diez de mango a 45 soles para don Lucho", 45)).toBe(true);
    expect(dijoA("tres cajas a S/ 1,200 lo debe", 1200)).toBe(true);
    expect(dijoA("diez de palta a 45.50", 45.5)).toBe(true);
    expect(dijoA("diez de palta a 45,50", 45.5)).toBe(true);
  });

  it("un total dicho de otra forma no es «a N»", () => {
    expect(dijoA("Le vendí 10 cajas de mango a don Lucho, todo por 500, lo debe", 500)).toBe(false);
    expect(dijoA("Don Lucho se llevó 5 de piña, son 200", 200)).toBe(false);
    expect(dijoA("Diez de papaya en 300 las diez", 300)).toBe(false);
  });

  it("no confunde un número con otro que empieza igual («a 5000» no es «a 500»), ni «para» con «a»", () => {
    expect(dijoA("diez de mango a 5000", 500)).toBe(false);
    expect(dijoA("diez de mango a 500.50", 500)).toBe(false);
    expect(dijoA("diez de mango para 500 personas", 500)).toBe(false);
  });
});

describe("precioQueEraTotal", () => {
  const frase = "Vendí 10 cajas de mango a don Lucho a 500 y pagó solo 1000";

  it("el «total» que se dijo como «a N» vuelve a ser el precio por caja", () => {
    expect(precioQueEraTotal(frase, [{ precio_unitario: null, total_item: 500 }])).toEqual([{ precio_unitario: 500, total_item: null }]);
  });

  it("un total de verdad («todo por 500») se queda como total", () => {
    const items = [{ precio_unitario: null, total_item: 500 }];
    expect(precioQueEraTotal("Le vendí 10 cajas de mango a don Lucho, todo por 500, lo debe", items)).toEqual(items);
  });

  it("con precio dicho o sin total, no se toca", () => {
    const items = [{ precio_unitario: 45, total_item: null }, { precio_unitario: null, total_item: null }];
    expect(precioQueEraTotal("diez a 45 y cinco de piña", items)).toEqual(items);
  });
});
