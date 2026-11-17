import { describe, expect, it } from "vitest";

import { abreTeclado, cuentaComoEscrito, tecladoAbierto } from "./teclado-reglas";

describe("abreTeclado", () => {
  it("los campos de texto, número y teléfono abren el teclado", () => {
    for (const tipo of ["text", "tel", "number", "email", "search", "", null]) expect(abreTeclado({ etiqueta: "INPUT", tipo })).toBe(true);
    expect(abreTeclado({ etiqueta: "TEXTAREA" })).toBe(true);
    expect(abreTeclado({ etiqueta: "DIV", editable: true })).toBe(true);
  });

  it("una casilla, un botón o un campo de solo lectura, no", () => {
    for (const tipo of ["checkbox", "radio", "button", "submit", "range", "color"]) expect(abreTeclado({ etiqueta: "INPUT", tipo })).toBe(false);
    expect(abreTeclado({ etiqueta: "INPUT", tipo: "text", soloLectura: true })).toBe(false);
    expect(abreTeclado({ etiqueta: "BUTTON" })).toBe(false);
  });
});

describe("cuentaComoEscrito", () => {
  it("un nombre, un teléfono o un monto se cuidan; una búsqueda no", () => {
    expect(cuentaComoEscrito({ etiqueta: "INPUT", tipo: "text" })).toBe(true);
    expect(cuentaComoEscrito({ etiqueta: "INPUT", tipo: "tel" })).toBe(true);
    expect(cuentaComoEscrito({ etiqueta: "TEXTAREA" })).toBe(true);
    expect(cuentaComoEscrito({ etiqueta: "INPUT", tipo: "search" })).toBe(false);
    expect(cuentaComoEscrito({ etiqueta: "INPUT", tipo: "checkbox" })).toBe(false);
  });
});

describe("tecladoAbierto", () => {
  it("con el foco en un campo y la pantalla 300 px más baja, está abierto", () => {
    expect(tecladoAbierto({ altoMaximo: 915, altoActual: 600, escribiendo: true })).toBe(true);
  });

  it("si la pantalla bajó poco (la barra del navegador), no", () => {
    expect(tecladoAbierto({ altoMaximo: 915, altoActual: 860, escribiendo: true })).toBe(false);
  });

  it("sin un campo con el foco, no, aunque la pantalla sea más baja", () => {
    expect(tecladoAbierto({ altoMaximo: 915, altoActual: 600, escribiendo: false })).toBe(false);
  });
});
