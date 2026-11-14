import { describe, expect, it } from "vitest";

import { diaAnterior, formatearGrados, hayQuePedirla, redondearGrados, saltoRaro, temperaturaDe, temperaturaValida } from "./temperatura-reglas";

describe("diaAnterior", () => {
  it("retrocede un día, también al cruzar el mes y el año", () => {
    expect(diaAnterior("2026-11-14")).toBe("2026-11-13");
    expect(diaAnterior("2026-11-01")).toBe("2026-10-31");
    expect(diaAnterior("2027-01-01")).toBe("2026-12-31");
  });

  it("retrocede varios días", () => expect(diaAnterior("2026-11-14", 6)).toBe("2026-11-08"));
});

describe("temperaturaValida", () => {
  it("acepta lo que puede marcar el termómetro del puesto", () => {
    expect(temperaturaValida(29)).toBe(true);
    expect(temperaturaValida(5)).toBe(true);
    expect(temperaturaValida(45)).toBe(true);
  });

  it("rechaza un número que no es clima: «290», bajo cero, nada", () => {
    expect(temperaturaValida(290)).toBe(false);
    expect(temperaturaValida(-3)).toBe(false);
    expect(temperaturaValida(4.9)).toBe(false);
    expect(temperaturaValida(null)).toBe(false);
    expect(temperaturaValida(Number.NaN)).toBe(false);
  });
});

describe("formatearGrados", () => {
  it("sin decimales si es entero, con uno si no", () => {
    expect(formatearGrados(29)).toBe("29°");
    expect(formatearGrados(28.5)).toBe("28.5°");
  });

  it("redondearGrados deja un decimal como mucho", () => {
    expect(redondearGrados(28.46)).toBe(28.5);
    expect(redondearGrados(29)).toBe(29);
  });
});

describe("temperaturaDe", () => {
  const lecturas = [
    { dia: "2026-11-13", grados: 30 },
    { dia: "2026-11-14", grados: 29 },
  ];

  it("da la del día pedido", () => expect(temperaturaDe(lecturas, "2026-11-13")).toBe(30));
  it("null si ese día no se anotó: no se inventa", () => expect(temperaturaDe(lecturas, "2026-11-12")).toBeNull());
});

describe("hayQuePedirla", () => {
  it("la pide si hoy no se anotó y esta semana sí", () => expect(hayQuePedirla([{ dia: "2026-11-13", grados: 30 }], "2026-11-14")).toBe(true));
  it("no la pide si ya se anotó hoy", () => expect(hayQuePedirla([{ dia: "2026-11-13", grados: 30 }, { dia: "2026-11-14", grados: 29 }], "2026-11-14")).toBe(false));
  it("no persigue a quien nunca la anotó", () => expect(hayQuePedirla([], "2026-11-14")).toBe(false));
});

describe("saltoRaro", () => {
  it("avisa si se aleja 6 grados o más de la de ayer: «39» por «29»", () => {
    expect(saltoRaro(39, 30)).toBe(true);
    expect(saltoRaro(24, 30)).toBe(true);
  });

  it("no avisa por un cambio normal de un día a otro", () => expect(saltoRaro(33, 30)).toBe(false));
  it("sin la de ayer no hay con qué comparar", () => expect(saltoRaro(39, null)).toBe(false));
});
