import { describe, expect, it } from "vitest";

import { abonoActual, borradorAbono, faltaAbono, frasesFaltaAbono, fueCorregidoAbono, leerAbono, pedidoAbono, saldoTrasAbono } from "./confirmar-abono-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Abono = Extract<Tarjeta, { tipo: "abono" }>;

const lucho = { id: 1, nombre: "Luis Paredes" };
const tarjeta = (cambios: Partial<Abono> = {}): Abono => ({
  tipo: "abono",
  cliente: { dicho: "don lucho", elegido: lucho, opciones: [] },
  monto: 80,
  medio: "efectivo",
  dudas: [],
  falta: [],
  ...cambios,
});

describe("borradorAbono y faltaAbono", () => {
  it("lo dicho completo se puede confirmar de una", () => {
    const b = borradorAbono(tarjeta());
    expect(b).toEqual({ cliente: lucho, monto: 80, medio: "efectivo" });
    expect(faltaAbono(b)).toEqual([]);
  });

  it("sin cliente elegido no se guarda: un abono siempre es de alguien", () => {
    const b = borradorAbono(tarjeta({ cliente: { dicho: "el flaco", elegido: null, opciones: [] } }));
    expect(faltaAbono(b)).toEqual(["cliente"]);
    expect(frasesFaltaAbono(faltaAbono(b))).toBe("Falta elegir quién te pagó.");
  });

  it("un monto en cero, con tres decimales o absurdo falta", () => {
    expect(faltaAbono({ cliente: lucho, monto: null, medio: "yape" })).toEqual(["monto"]);
    expect(faltaAbono({ cliente: lucho, monto: 80.555, medio: "yape" })).toEqual(["monto"]);
    expect(faltaAbono({ cliente: lucho, monto: 1_000_000, medio: "yape" })).toEqual(["monto"]);
    expect(frasesFaltaAbono(["cliente", "monto"])).toBe("Falta elegir quién te pagó y cuánto te dio.");
  });
});

describe("leerAbono", () => {
  it("lee el monto como cualquier monto, con su nombre", () => {
    expect(leerAbono("80,50")).toEqual({ ok: true, valor: 80.5 });
    expect(leerAbono("0")).toEqual({ ok: false, error: "El monto tiene que ser más que cero." });
  });
});

describe("saldoTrasAbono", () => {
  it("dice cómo queda: debe, al día o a favor", () => {
    expect(saldoTrasAbono(230, 80)).toEqual({ tipo: "debe", monto: 150 });
    expect(saldoTrasAbono(230, 230)).toEqual({ tipo: "al_dia" });
    // Decisión del 31-10: se deja guardar, pero se dice en grande para que un error de oído salte a la vista.
    expect(saldoTrasAbono(230, 300)).toEqual({ tipo: "a_favor", monto: 70 });
  });

  it("cuenta en céntimos, sin restos de coma flotante", () => {
    expect(saldoTrasAbono(100.3, 0.1)).toEqual({ tipo: "debe", monto: 100.2 });
  });
});

describe("fueCorregidoAbono", () => {
  it("elegir el cliente que se preguntó no es corregir; cambiar lo dicho, sí", () => {
    const dudoso = tarjeta({ cliente: { dicho: "el flaco", elegido: null, opciones: [] } });
    expect(fueCorregidoAbono(dudoso, { cliente: lucho, monto: 80, medio: "efectivo" })).toBe(false);
    expect(fueCorregidoAbono(tarjeta(), { cliente: lucho, monto: 80, medio: "efectivo" })).toBe(false);
    expect(fueCorregidoAbono(tarjeta(), { cliente: lucho, monto: 800, medio: "efectivo" })).toBe(true);
    expect(fueCorregidoAbono(tarjeta(), { cliente: lucho, monto: 80, medio: "yape" })).toBe(true);
    expect(fueCorregidoAbono(tarjeta(), { cliente: { id: 4, nombre: "Bodega Santa Ana" }, monto: 80, medio: "efectivo" })).toBe(true);
  });
});

describe("pedidoAbono", () => {
  it("arma lo que va a la tabla abonos, con su comando", () => {
    expect(pedidoAbono({ cliente: lucho, monto: 80, medio: "plin" }, 33)).toEqual({ cliente_id: 1, monto: 80, medio_pago: "plin", comando_voz_id: 33 });
  });

  it("si falta algo, no hay pedido: nunca se guarda un abono a medias", () => {
    expect(pedidoAbono({ cliente: null, monto: 80, medio: "plin" }, 33)).toBeNull();
    expect(pedidoAbono({ cliente: lucho, monto: null, medio: "plin" }, 33)).toBeNull();
  });
});

describe("abonoActual (ADR-0027)", () => {
  it("el abono en los campos de registrar_abono; sin cliente elegido, lo que se dijo", () => {
    expect(abonoActual({ cliente: { id: 1, nombre: "Luis Paredes" }, monto: 200, medio: "yape" }, "lucho")).toEqual({
      operacion: "abono",
      datos: { cliente_texto: "Luis Paredes", monto: 200, medio_pago: "yape" },
    });
    expect(abonoActual({ cliente: null, monto: 200, medio: "efectivo" }, "lucho").datos.cliente_texto).toBe("lucho");
  });
});
