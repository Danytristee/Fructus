import { describe, expect, it } from "vitest";

import { cajasEnPalabras, numeroEnPalabras, solesEnPalabras } from "./palabras-reglas";

describe("numeroEnPalabras", () => {
  it("dice los números como se dicen", () => {
    expect(numeroEnPalabras(0)).toBe("cero");
    expect(numeroEnPalabras(1)).toBe("uno");
    expect(numeroEnPalabras(15)).toBe("quince");
    expect(numeroEnPalabras(16)).toBe("dieciséis");
    expect(numeroEnPalabras(21)).toBe("veintiuno");
    expect(numeroEnPalabras(22)).toBe("veintidós");
    expect(numeroEnPalabras(45)).toBe("cuarenta y cinco");
    expect(numeroEnPalabras(100)).toBe("cien");
    expect(numeroEnPalabras(101)).toBe("ciento uno");
    expect(numeroEnPalabras(230)).toBe("doscientos treinta");
    expect(numeroEnPalabras(555)).toBe("quinientos cincuenta y cinco");
    expect(numeroEnPalabras(1000)).toBe("mil");
    expect(numeroEnPalabras(2472)).toBe("dos mil cuatrocientos setenta y dos");
    expect(numeroEnPalabras(21_000)).toBe("veintiún mil");
    expect(numeroEnPalabras(100_000)).toBe("cien mil");
    expect(numeroEnPalabras(1_250_000)).toBe("un millón doscientos cincuenta mil");
    expect(numeroEnPalabras(3_000_000)).toBe("tres millones");
  });
});

describe("solesEnPalabras", () => {
  it("con «un» delante de soles y los céntimos aparte", () => {
    expect(solesEnPalabras(1)).toBe("un sol");
    expect(solesEnPalabras(21)).toBe("veintiún soles");
    expect(solesEnPalabras(230)).toBe("doscientos treinta soles");
    expect(solesEnPalabras(2472.5)).toBe("dos mil cuatrocientos setenta y dos soles con cincuenta céntimos");
    expect(solesEnPalabras(0.01)).toBe("un céntimo");
    expect(solesEnPalabras(0)).toBe("cero soles");
  });

  it("redondea al céntimo, sin restos de coma flotante", () => {
    expect(solesEnPalabras(0.1 + 0.2)).toBe("treinta céntimos");
  });
});

describe("cajasEnPalabras", () => {
  it("una caja, media caja y las demás", () => {
    expect(cajasEnPalabras(1)).toBe("una caja");
    expect(cajasEnPalabras(21)).toBe("veintiuna cajas");
    expect(cajasEnPalabras(12)).toBe("doce cajas");
    expect(cajasEnPalabras(0.5)).toBe("media caja");
    expect(cajasEnPalabras(2.5)).toBe("dos cajas y media");
    expect(cajasEnPalabras(0)).toBe("ninguna caja");
  });

  it("lo que no es media caja se dice en cifras: no se inventa una fracción", () => {
    expect(cajasEnPalabras(1.25)).toBe("1.25 cajas");
  });
});
