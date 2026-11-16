import { describe, expect, it } from "vitest";

import { borradorCompra, faltaCompra, frasesFaltaCompra, fueCorregidaCompra, leerCosto, pedidoCompra, totalCompra, type BorradorCompra } from "./confirmar-compra-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Compra = Extract<Tarjeta, { tipo: "compra" }>;

const chao = { id: 2, nombre: "Agrícola Chao" };
const isla = { id: 4, nombre: "Plátano isla" };
const tarjeta = (cambios: Partial<Compra> = {}): Compra => ({
  tipo: "compra",
  proveedor: { dicho: "el de chao", elegido: chao, opciones: [] },
  items: [{ producto: { dicho: "plátano isla", elegido: isla, opciones: [] }, cantidad: 50, costo: { valor: 25, sugerido: false } }],
  condicion: "credito",
  dudas: [],
  falta: [],
  ...cambios,
});

describe("borradorCompra y faltaCompra", () => {
  it("lo dicho completo se puede confirmar de una", () => {
    const b = borradorCompra(tarjeta());
    expect(b).toEqual({
      proveedor: chao,
      items: [{ productoId: 4, producto: "Plátano isla", cantidad: 50, precio: 25, sugerido: false, estado: null }],
      condicion: "credito",
      medio: null,
    });
    expect(faltaCompra(b)).toEqual([]);
  });

  it("nunca asume contado: sin condición, se pregunta", () => {
    const b = borradorCompra(tarjeta({ condicion: null }));
    expect(faltaCompra(b)).toEqual(["condicion"]);
  });

  it("al contado sin medio dicho, efectivo a la vista", () => {
    expect(borradorCompra(tarjeta({ condicion: "contado" })).medio).toBe("efectivo");
  });

  it("al crédito sin proveedor no se guarda: una deuda siempre es con alguien", () => {
    const b = borradorCompra(tarjeta({ proveedor: { dicho: null, elegido: null, opciones: [] } }));
    expect(faltaCompra(b)).toEqual(["proveedor"]);
    expect(frasesFaltaCompra(faltaCompra(b))).toBe("Falta elegir a quién le debes.");
  });

  it("sin costo, costo cero o fruta sin elegir falta", () => {
    const sinCosto: BorradorCompra = { ...borradorCompra(tarjeta()), items: [{ productoId: 4, producto: "Plátano isla", cantidad: 50, precio: null, sugerido: false }] };
    expect(faltaCompra(sinCosto)).toEqual(["costo"]);
    expect(faltaCompra({ ...sinCosto, items: [{ ...sinCosto.items[0]!, precio: 0 }] })).toEqual(["costo"]);
    expect(faltaCompra({ ...sinCosto, items: [{ ...sinCosto.items[0]!, productoId: null, precio: 25 }] })).toEqual(["producto"]);
    expect(frasesFaltaCompra(["producto", "costo", "condicion"])).toBe("Falta elegir qué fruta fue, a cuánto la caja y si la pagaste o la debes.");
  });
});

describe("totalCompra", () => {
  it("suma ítem por ítem en céntimos, como la base", () => {
    const b = borradorCompra(tarjeta());
    expect(totalCompra(b)).toBe(1250);
    expect(totalCompra({ ...b, items: [{ ...b.items[0]!, cantidad: 0.5, precio: 47.33 }] })).toBe(23.67);
    expect(totalCompra({ ...b, items: [{ ...b.items[0]!, precio: null }] })).toBeNull();
  });
});

describe("leerCosto", () => {
  it("lee el costo con su nombre", () => {
    expect(leerCosto("25")).toEqual({ ok: true, valor: 25 });
    expect(leerCosto("0")).toEqual({ ok: false, error: "El costo tiene que ser más que cero." });
  });
});

describe("fueCorregidaCompra", () => {
  it("elegir lo que se preguntó no es corregir; cambiar lo dicho, sí", () => {
    const b = borradorCompra(tarjeta());
    expect(fueCorregidaCompra(tarjeta(), b)).toBe(false);
    expect(fueCorregidaCompra(tarjeta({ condicion: null }), { ...b, condicion: "contado", medio: "efectivo" })).toBe(false);
    expect(fueCorregidaCompra(tarjeta(), { ...b, condicion: "contado", medio: "efectivo" })).toBe(true);
    expect(fueCorregidaCompra(tarjeta(), { ...b, items: [{ ...b.items[0]!, cantidad: 40 }] })).toBe(true);
    expect(fueCorregidaCompra(tarjeta(), { ...b, proveedor: { id: 1, nombre: "Transportes Piura Norte" } })).toBe(true);
  });
});

describe("pedidoCompra", () => {
  it("arma lo que recibe registrar_compra", () => {
    expect(pedidoCompra(borradorCompra(tarjeta()), 33, false)).toEqual({
      proveedor_id: 2,
      condicion: "credito",
      medio_pago: null,
      comando_voz_id: 33,
      corregido: false,
      items: [{ producto_id: 4, cantidad: 50, costo_unitario: 25, estado_llegada: null }],
    });
  });

  it("si falta algo, no hay pedido: nunca se guarda una compra a medias", () => {
    expect(pedidoCompra(borradorCompra(tarjeta({ condicion: null })), 33, false)).toBeNull();
  });
});

describe("cómo llegó la fruta", () => {
  const conEstado = (estado: "verde" | "pinton" | "maduro" | null) => {
    const t = tarjeta();
    return { ...t, items: t.items.map((it) => ({ ...it, estado })) };
  };

  it("lo que se dijo llega al borrador y de ahí a la entrada de stock", () => {
    const b = borradorCompra(conEstado("verde"));
    expect(b.items[0]!.estado).toBe("verde");
    expect(pedidoCompra({ ...b, condicion: "contado", medio: "efectivo" }, 7, false)!.items[0]!.estado_llegada).toBe("verde");
  });

  it("si no se dijo queda sin decir: no se inventa (la cuenta lo trata como pintón)", () => {
    const b = borradorCompra(conEstado(null));
    expect(pedidoCompra({ ...b, condicion: "contado", medio: "efectivo" }, 7, false)!.items[0]!.estado_llegada).toBeNull();
  });

  it("una tarjeta vieja de la cola, sin el campo, se lee igual", () => {
    expect(borradorCompra(tarjeta()).items[0]!.estado).toBeNull();
  });

  it("en una fruta que no madura en la caja no se guarda, aunque se haya dicho", () => {
    const b = borradorCompra(conEstado("verde"));
    const pina = { ...b, items: [{ ...b.items[0]!, producto: "Piña golden" }], condicion: "contado" as const, medio: "efectivo" as const };
    expect(pedidoCompra(pina, 7, false)!.items[0]!.estado_llegada).toBeNull();
  });

  it("cambiar lo que se dijo es corregir; elegirlo cuando no se dijo, no", () => {
    const dicho = conEstado("verde");
    const b = borradorCompra(dicho);
    expect(fueCorregidaCompra(dicho, { ...b, items: [{ ...b.items[0]!, estado: "maduro" }] })).toBe(true);
    const sinDecir = conEstado(null);
    const b2 = borradorCompra(sinDecir);
    expect(fueCorregidaCompra(sinDecir, { ...b2, items: [{ ...b2.items[0]!, estado: "maduro" }] })).toBe(false);
  });
});
