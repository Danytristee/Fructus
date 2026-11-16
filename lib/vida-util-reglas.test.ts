import { describe, expect, it } from "vitest";

import { maduraEnLaCaja, vidaDeLlegada, vidaUtilDias } from "./vida-util-reglas";

describe("vidaDeLlegada", () => {
  it("sin decir cómo llegó, dura lo de la tabla", () => {
    expect(vidaDeLlegada("Mango Kent", null)).toBe(vidaUtilDias("Mango Kent"));
    expect(vidaDeLlegada("Mango Kent", undefined)).toBe(7);
  });

  it("la que llega verde aguanta más; la madura, la mitad", () => {
    expect(vidaDeLlegada("Mango Kent", "pinton")).toBe(7);
    expect(vidaDeLlegada("Mango Kent", "verde")).toBe(9.8);
    expect(vidaDeLlegada("Mango Kent", "maduro")).toBe(3.5);
  });

  it("a la fruta que no madura en la caja no le cambia: una piña «verde» dura lo mismo", () => {
    expect(vidaDeLlegada("Piña golden", "verde")).toBe(7);
    expect(vidaDeLlegada("Manzana Verde", "maduro")).toBe(30);
  });

  it("nunca menos de un día: lo que llega, por lo menos hoy se puede vender", () => expect(vidaDeLlegada("Papaya", "maduro")).toBeGreaterThanOrEqual(1));
});

describe("maduraEnLaCaja", () => {
  it("sí: plátano, mango, palta, papaya; sin importar tildes ni variedad", () => {
    for (const fruta of ["Plátano de seda", "Mango Kent", "Palta fuerte", "Papaya", "Maracuyá"]) expect(maduraEnLaCaja(fruta), fruta).toBe(true);
  });

  it("no: los cítricos, la uva, la piña, la manzana", () => {
    for (const fruta of ["Limón", "Uva red globe", "Piña golden", "Manzana Royal", "Mandarina"]) expect(maduraEnLaCaja(fruta), fruta).toBe(false);
  });
});
