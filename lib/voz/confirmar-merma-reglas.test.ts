import { describe, expect, it } from "vitest";

import { borradorMerma, faltaMerma, frasesFaltaMerma, fueCorregidaMerma, pedidoMerma, quedanTrasMerma } from "./confirmar-merma-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Merma = Extract<Tarjeta, { tipo: "merma" }>;

const mango = { id: 1, nombre: "Mango Kent" };
const tarjeta = (cambios: Partial<Merma> = {}): Merma => ({
  tipo: "merma",
  producto: { dicho: "mango", elegido: mango, opciones: [] },
  cantidad: 3,
  motivo: "se malogró",
  falta: [],
  ...cambios,
});

describe("borradorMerma y faltaMerma", () => {
  it("lo dicho completo se puede confirmar de una", () => {
    const b = borradorMerma(tarjeta());
    expect(b).toEqual({ producto: mango, cantidad: 3, motivo: "se malogró" });
    expect(faltaMerma(b)).toEqual([]);
  });

  it("sin fruta elegida no se guarda", () => {
    const b = borradorMerma(tarjeta({ producto: { dicho: "uva", elegido: null, opciones: [] } }));
    expect(faltaMerma(b)).toEqual(["producto"]);
    expect(frasesFaltaMerma(faltaMerma(b))).toBe("Falta elegir qué fruta se malogró.");
  });

  it("media caja vale; cero, tres decimales o un número absurdo, no", () => {
    expect(faltaMerma({ producto: mango, cantidad: 0.5, motivo: null })).toEqual([]);
    expect(faltaMerma({ producto: mango, cantidad: 0, motivo: null })).toEqual(["cantidad"]);
    expect(faltaMerma({ producto: mango, cantidad: 1.255, motivo: null })).toEqual(["cantidad"]);
    expect(faltaMerma({ producto: mango, cantidad: 50_000, motivo: null })).toEqual(["cantidad"]);
  });
});

describe("quedanTrasMerma", () => {
  it("resta en céntimos y puede quedar en negativo (se permite y se avisa)", () => {
    expect(quedanTrasMerma(12, 3)).toBe(9);
    expect(quedanTrasMerma(1.1, 0.5)).toBe(0.6);
    expect(quedanTrasMerma(2, 3)).toBe(-1);
  });
});

describe("fueCorregidaMerma", () => {
  it("elegir la fruta que se preguntó no es corregir; cambiarla o cambiar las cajas, sí", () => {
    const dudosa = tarjeta({ producto: { dicho: "uva", elegido: null, opciones: [] } });
    expect(fueCorregidaMerma(dudosa, { producto: mango, cantidad: 3, motivo: "se malogró" })).toBe(false);
    expect(fueCorregidaMerma(tarjeta(), { producto: mango, cantidad: 3, motivo: "se malogró" })).toBe(false);
    expect(fueCorregidaMerma(tarjeta(), { producto: mango, cantidad: 4, motivo: "se malogró" })).toBe(true);
    expect(fueCorregidaMerma(tarjeta(), { producto: { id: 2, nombre: "Piña Golden" }, cantidad: 3, motivo: "se malogró" })).toBe(true);
  });
});

describe("pedidoMerma", () => {
  it("arma la salida de stock: en negativo, con su motivo y su comando", () => {
    expect(pedidoMerma({ producto: mango, cantidad: 3, motivo: "se malogró" }, 33)).toEqual({
      producto_id: 1,
      tipo: "merma",
      cantidad: -3,
      motivo: "se malogró",
      comando_voz_id: 33,
    });
  });

  it("si falta algo, no hay pedido", () => {
    expect(pedidoMerma({ producto: null, cantidad: 3, motivo: null }, 33)).toBeNull();
  });
});
