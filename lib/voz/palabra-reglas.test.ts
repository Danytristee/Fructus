import { describe, expect, test } from "vitest";

import { ATENCION_NUEVA, CUADROS_DE_ESPERA, CUADROS_SEGUIDOS, UMBRAL, atender, revisarFrase } from "./palabra-reglas";

/** En qué cuadros (desde 1) despierta con esta lista de puntajes. */
function despiertaEn(puntajes: number[]): number[] {
  let atencion = ATENCION_NUEVA;
  const cuadros: number[] = [];
  puntajes.forEach((p, i) => {
    const r = atender(atencion, p);
    atencion = r.atencion;
    if (r.desperto) cuadros.push(i + 1);
  });
  return cuadros;
}

describe("cuándo despierta «Hola Fructus»", () => {
  test("con tres cuadros seguidos sobre el umbral, en el tercero", () => {
    expect(CUADROS_SEGUIDOS).toBe(3);
    expect(despiertaEn([0, 0.1, 0.95, 0.97, 0.98, 0.2])).toEqual([5]);
  });

  test("el umbral justo cuenta", () => {
    expect(despiertaEn([UMBRAL, UMBRAL, UMBRAL])).toEqual([3]);
  });

  test("un golpe que pasa el umbral uno o dos cuadros no despierta, y la cuenta vuelve a cero", () => {
    expect(despiertaEn([0.99, 0.3, 0.99, 0.99, 0.5, 0.99, 0.2])).toEqual([]);
    expect(despiertaEn([0.95, 0.95, 0.89, 0.95, 0.95, 0.95])).toEqual([6]);
  });

  test("la misma frase no despierta dos veces: después espera 2 s", () => {
    expect(CUADROS_DE_ESPERA * 80).toBe(2000);
    // Puntaje alto todo el rato: despierta en el 3, espera 25 cuadros y vuelve a contar desde cero (3 más).
    expect(despiertaEn(Array(40).fill(0.99))).toEqual([3, 3 + CUADROS_DE_ESPERA + 3]);
  });
});

describe("el segundo paso: cómo escribió Whisper lo que siguió a «Hola Fructus»", () => {
  // Las transcripciones de Groq (whisper-large-v3-turbo) de tests/palabra/, el 2026-11-16, son las primeras de cada lista.
  test("si escribió la frase, se quita y queda la orden", () => {
    expect(revisarFrase(" Hola Fructus, vendí 10 cajas de mango que entado mucho, lo debe.")).toEqual({
      veredicto: "dijo",
      orden: "vendí 10 cajas de mango que entado mucho, lo debe.",
    });
    expect(revisarFrase("Ola Fructus. ¿Quién me debe?")).toEqual({ veredicto: "dijo", orden: "¿Quién me debe?" });
    expect(revisarFrase("Hola, Fruktus: se malograron tres cajas de papaya")).toEqual({ veredicto: "dijo", orden: "se malograron tres cajas de papaya" });
    expect(revisarFrase("hola fructos vendí dos cajas")).toEqual({ veredicto: "dijo", orden: "vendí dos cajas" });
    expect(revisarFrase("Hola, Fruc tus. Cuánto vendí hoy")).toEqual({ veredicto: "dijo", orden: "Cuánto vendí hoy" });
  });

  test("con algo dicho antes de la frase (lo grabado de antes de despertar), también", () => {
    expect(revisarFrase("Ya, gracias, casera. Hola Fructus, anota diez cajas de mango.")).toEqual({ veredicto: "dijo", orden: "anota diez cajas de mango." });
  });

  test("si solo dijo la frase, la orden queda vacía", () => {
    expect(revisarFrase("Hola Fructus.")).toEqual({ veredicto: "dijo", orden: "" });
  });

  test("«fruta» o «frutas» al principio, sin «Fructus» antes, era una frase parecida", () => {
    expect(revisarFrase(" Hola, hay frutas.")).toEqual({ veredicto: "parecida" });
    expect(revisarFrase("Hola casera, fruta fresca, pase nomás")).toEqual({ veredicto: "parecida" });
    expect(revisarFrase("Oye, ¿a cómo la fruta?")).toEqual({ veredicto: "parecida" });
    expect(revisarFrase("Hola frutero")).toEqual({ veredicto: "parecida" });
  });

  test("«Fructus» antes que «frutas» manda: la orden puede hablar de frutas", () => {
    expect(revisarFrase("Hola Fructus, ¿cuántas frutas tengo que vender hoy?")).toEqual({
      veredicto: "dijo",
      orden: "¿cuántas frutas tengo que vender hoy?",
    });
  });

  test("si Whisper escribió mal la marca, se interpreta todo como vino (no se tira una orden de verdad)", () => {
    expect(revisarFrase(" Hola, Fro, Boss.")).toEqual({ veredicto: "dudosa" });
    expect(revisarFrase(" Hola, frío, bus... Vendí diez cajas de mango a don Lucho, lo debe.")).toEqual({ veredicto: "dudosa" });
  });

  test("las palabras parecidas que no son la marca no cuentan como la frase", () => {
    expect(revisarFrase("Fructuoso me pagó cincuenta").veredicto).toBe("dudosa");
    expect(revisarFrase("la fructosa no se vende").veredicto).toBe("dudosa");
    expect(revisarFrase("Hola, frutos secos").veredicto).toBe("parecida");
  });

  test("lejos del principio ya es la orden: una fruta ahí no descarta nada", () => {
    expect(revisarFrase("Hola, ¿me das diez cajas de fruta?").veredicto).toBe("dudosa");
  });
});
