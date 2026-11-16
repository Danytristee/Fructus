import { describe, expect, it } from "vitest";

import { diaAnterior, formatearGrados, hayQuePedirla, redondearGrados, saltoRaro, semanaDeTemperaturas, temperaturaDe, temperaturaValida, veredictoClima } from "./temperatura-reglas";

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

describe("veredictoClima", () => {
  it("dice qué le hace esa temperatura a la fruta", () => {
    expect(veredictoClima(31)).toMatchObject({ nivel: "fuerte", titulo: "Calor fuerte" });
    expect(veredictoClima(29)).toMatchObject({ nivel: "calor", titulo: "Hace calor", efecto: "la fruta dura menos." });
    expect(veredictoClima(24)).toMatchObject({ nivel: "normal" });
    expect(veredictoClima(18)).toMatchObject({ nivel: "fresco", efecto: "la fruta aguanta más." });
  });
});

describe("semanaDeTemperaturas", () => {
  it("siete días con hoy al final; el que no se anotó queda vacío, no inventado", () => {
    const semana = semanaDeTemperaturas([{ dia: "2026-11-12", grados: 30 }, { dia: "2026-11-14", grados: 29 }], "2026-11-14");
    expect(semana.map((d) => d.dia)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(semana.map((d) => d.grados)).toEqual([null, null, null, null, 30, null, 29]);
  });
});

describe("hayQuePedirla", () => {
  it("la pide si hoy no se anotó y esta semana sí", () => expect(hayQuePedirla([{ dia: "2026-11-13", grados: 30 }], "2026-11-14")).toBe(true));
  it("no la pide si ya se anotó hoy", () => expect(hayQuePedirla([{ dia: "2026-11-13", grados: 30 }, { dia: "2026-11-14", grados: 29 }], "2026-11-14")).toBe(false));
  // Antes solo se le pedía a quien ya había anotado alguna esa semana: quien nunca la anotó no se enteraba de que podía
  // (primer uso, /formidable 2026-11-14), y al dejar de anotarla una semana el pedido desaparecía en silencio.
  it("también la pide a quien nunca la anotó: es la puerta de entrada", () => expect(hayQuePedirla([], "2026-11-14")).toBe(true));
  it("y a quien dejó de anotarla hace días", () => expect(hayQuePedirla([{ dia: "2026-11-02", grados: 30 }], "2026-11-14")).toBe(true));
});

describe("saltoRaro", () => {
  it("avisa si se aleja 6 grados o más de la de ayer: «39» por «29»", () => {
    expect(saltoRaro(39, 30)).toBe(true);
    expect(saltoRaro(24, 30)).toBe(true);
  });

  it("no avisa por un cambio normal de un día a otro", () => expect(saltoRaro(33, 30)).toBe(false));
  it("sin la de ayer no hay con qué comparar", () => expect(saltoRaro(39, null)).toBe(false));
});
