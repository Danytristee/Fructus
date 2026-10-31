import { describe, expect, it } from "vitest";

import { borradorGasto, faltaGasto, fueCorregidoGasto, leerGasto, pedidoGasto } from "./confirmar-gasto-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Gasto = Extract<Tarjeta, { tipo: "gasto" }>;

const tarjeta = (cambios: Partial<Gasto> = {}): Gasto => ({
  tipo: "gasto",
  categoria: "personal",
  monto: 50,
  descripcion: "cargador",
  medio: "efectivo",
  ...cambios,
});

describe("borradorGasto y faltaGasto", () => {
  it("lo dicho completo se puede confirmar de una", () => {
    const b = borradorGasto(tarjeta());
    expect(b).toEqual({ categoria: "personal", monto: 50, descripcion: "cargador", medio: "efectivo" });
    expect(faltaGasto(b)).toEqual([]);
  });

  it("un monto con tres decimales o absurdo falta", () => {
    expect(faltaGasto(borradorGasto(tarjeta({ monto: 12.345 })))).toEqual(["monto"]);
    expect(faltaGasto(borradorGasto(tarjeta({ monto: 1_000_000 })))).toEqual(["monto"]);
  });

  it("una categoría que la base no conoce va a «otros»: nunca se pierde el gasto", () => {
    expect(borradorGasto(tarjeta({ categoria: "almuerzo" })).categoria).toBe("otros");
  });
});

describe("leerGasto", () => {
  it("lee el monto con su nombre", () => {
    expect(leerGasto("35,50")).toEqual({ ok: true, valor: 35.5 });
    expect(leerGasto("-5")).toEqual({ ok: false, error: "El monto no puede ser negativo." });
  });
});

describe("fueCorregidoGasto", () => {
  it("cambiar la categoría, el monto o el medio es corregir", () => {
    const b = borradorGasto(tarjeta());
    expect(fueCorregidoGasto(tarjeta(), b)).toBe(false);
    expect(fueCorregidoGasto(tarjeta(), { ...b, categoria: "flete" })).toBe(true);
    expect(fueCorregidoGasto(tarjeta(), { ...b, monto: 60 })).toBe(true);
    expect(fueCorregidoGasto(tarjeta(), { ...b, medio: "yape" })).toBe(true);
  });
});

describe("pedidoGasto", () => {
  it("arma la fila de gastos con su comando", () => {
    expect(pedidoGasto(borradorGasto(tarjeta()), 33)).toEqual({ categoria: "personal", monto: 50, descripcion: "cargador", medio_pago: "efectivo", comando_voz_id: 33 });
  });

  it("si falta el monto, no hay pedido", () => {
    expect(pedidoGasto({ ...borradorGasto(tarjeta()), monto: null }, 33)).toBeNull();
  });
});
