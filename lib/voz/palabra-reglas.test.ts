import { describe, expect, test } from "vitest";

import { ATENCION_NUEVA, CUADROS_DE_ESPERA, CUADROS_SEGUIDOS, UMBRAL, atender } from "./palabra-reglas";

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
