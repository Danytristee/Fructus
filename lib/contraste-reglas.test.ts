import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contraste, tokensDe } from "./contraste-reglas";

describe("contraste", () => {
  it("da 21 entre negro y blanco, y 1 entre dos iguales", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contraste("#103d29", "#103d29")).toBe(1);
  });
  it("no depende del orden", () => {
    expect(contraste("#103d29", "#f7f5ee")).toBeCloseTo(contraste("#f7f5ee", "#103d29"), 10);
  });
  it("atrapa el verde de la propuesta que no se leía al sol", () => {
    expect(contraste("#348b50", "#f7f5ee")).toBeLessThan(4.5);
  });
});

// Los pares que se leen en la app, con el mínimo que pide CLAUDE.md. Si alguien cambia un token en globals.css y deja de leerse al sol,
// esta prueba falla antes de que llegue al puesto.
const css = readFileSync("app/globals.css", "utf8");
const pares: [texto: string, fondo: string, minimo: number][] = [
  ["texto", "fondo", 7],
  ["texto", "vidrio", 7],
  ["texto-suave", "fondo", 4.5],
  ["texto-suave", "vidrio", 4.5],
  ["acento-texto", "vidrio", 7],
  ["sobre-acento", "acento", 7],
  ["sobre-lima", "lima", 7],
  ["sobre-orbe", "orbe-1", 7],
  ["exito", "vidrio", 7],
  ["exito", "exito-fondo", 7],
  ["deuda", "vidrio", 7],
  ["deuda", "deuda-fondo", 7],
  ["sol", "vidrio", 4.5],
  ["borde", "fondo", 3],
];

describe.each([":root", '[data-theme="oscuro"]'] as const)("tokens de %s", (selector) => {
  const t = tokensDe(css, selector);
  it.each(pares)("%s sobre %s llega a %d:1", (texto, fondo, minimo) => {
    const a = t[texto];
    const b = t[fondo];
    if (!a || !b) throw new Error(`falta --${a ? fondo : texto} en ${selector}`);
    expect(contraste(a, b)).toBeGreaterThanOrEqual(minimo);
  });
});
