import { describe, expect, it } from "vitest";

import { borradorDe, faltaDe, frasesFalta, fueCorregido, leerPrecio, pedidoVenta, repartirDescuento, totalDe, type Borrador, ventaActual } from "./confirmar-venta-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Venta = Extract<Tarjeta, { tipo: "venta" }>;

const venta = (cambios: Partial<Venta> = {}): Venta => ({
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] },
  items: [
    { producto: { dicho: "mango", elegido: { id: 10, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: true }, subtotal: 450 },
  ],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
  ...cambios,
});

describe("borradorDe", () => {
  it("toma lo que se entendió, con el precio sugerido marcado", () => {
    expect(borradorDe(venta())).toEqual({
      cliente: { id: 1, nombre: "Luis Paredes" },
      items: [{ productoId: 10, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: true }],
      descuento: 0,
      condicion: "credito",
      medio: null,
      comprobante: "ninguno",
    });
  });

  it("lleva el comprobante que se dijo («… factura»): la persona lo ve en la tarjeta y lo puede cambiar", () => {
    expect(borradorDe(venta({ comprobante: "factura" })).comprobante).toBe("factura");
    expect(borradorDe(venta({ comprobante: "boleta" })).comprobante).toBe("boleta");
  });

  it("al contado sin medio dicho, efectivo (a la vista, se puede cambiar)", () => {
    expect(borradorDe(venta({ condicion: "contado", medio: null })).medio).toBe("efectivo");
    expect(borradorDe(venta({ condicion: "contado", medio: "yape" })).medio).toBe("yape");
  });

  it("un producto sin elegir guarda lo que se dijo", () => {
    const b = borradorDe(venta({ items: [{ producto: { dicho: "manguito", elegido: null, opciones: [] }, cantidad: 2, precio: { valor: null, sugerido: false }, subtotal: null }] }));
    expect(b.items[0]).toEqual({ productoId: null, producto: "manguito", cantidad: 2, precio: null, sugerido: false });
  });
});

describe("faltaDe y frasesFalta", () => {
  const b = (cambios: Partial<Borrador>): Borrador => ({ ...borradorDe(venta()), ...cambios });

  it("con todo, no falta nada", () => {
    expect(faltaDe(b({}))).toEqual([]);
    expect(frasesFalta([])).toBeNull();
  });

  it("nunca asume contado: sin condición, falta", () => {
    expect(faltaDe(b({ condicion: null }))).toEqual(["condicion"]);
  });

  it("al crédito necesita cliente; al contado no", () => {
    expect(faltaDe(b({ cliente: null }))).toEqual(["cliente"]);
    expect(faltaDe(b({ cliente: null, condicion: "contado", medio: "efectivo" }))).toEqual([]);
  });

  it("un precio de 0 cuenta como que falta", () => {
    const base = b({});
    expect(faltaDe({ ...base, items: [{ ...base.items[0]!, precio: 0 }] })).toEqual(["precio"]);
  });

  it("sin precio, sin fruta o con cero cajas, falta", () => {
    expect(faltaDe(b({ items: [{ productoId: null, producto: "x", cantidad: 0, precio: null, sugerido: false }] }))).toEqual(["producto", "cantidad", "precio"]);
  });

  it("lo dice en lenguaje de puesto", () => {
    expect(frasesFalta(["precio", "condicion"])).toBe("Falta elegir a cuánto la caja y si pagó o lo debe.");
    expect(frasesFalta(["cliente", "producto", "condicion"])).toBe("Falta elegir a quién le fiaste, qué fruta fue y si pagó o lo debe.");
  });
});

describe("totalDe", () => {
  it("suma cajas por precio y resta la rebaja", () => {
    const b = borradorDe(venta());
    expect(totalDe({ ...b, descuento: 10 })).toBe(440);
  });

  it("sin precio no hay total", () => {
    const b = borradorDe(venta());
    expect(totalDe({ ...b, items: [{ ...b.items[0]!, precio: null }] })).toBeNull();
  });
});

describe("repartirDescuento", () => {
  it("reparte según el peso de cada fruta y cuadra al céntimo", () => {
    const partes = repartirDescuento([450, 150], 10);
    expect(partes).toEqual([7.5, 2.5]);
    expect(repartirDescuento([100, 100, 100], 10).reduce((s, x) => s + x, 0)).toBeCloseTo(10, 10);
  });

  it("lo que sobra del redondeo va a la fruta más grande", () => {
    expect(repartirDescuento([100, 100, 101], 1)).toEqual([0.33, 0.33, 0.34]);
  });

  it("sin rebaja, cero; y nunca más que lo que vale la venta", () => {
    expect(repartirDescuento([450], 0)).toEqual([0]);
    expect(repartirDescuento([40, 10], 80)).toEqual([40, 10]);
  });
});

describe("fueCorregido", () => {
  it("sin cambios, no", () => {
    expect(fueCorregido(venta(), borradorDe(venta()))).toBe(false);
  });

  it("elegir «Pagó» cuando se preguntó no es corregir", () => {
    const t = venta({ condicion: null });
    expect(fueCorregido(t, { ...borradorDe(t), condicion: "contado", medio: "efectivo" })).toBe(false);
  });

  it("cambiar el cliente, el precio o lo que se dijo de pago, sí", () => {
    const t = venta();
    const b = borradorDe(t);
    expect(fueCorregido(t, { ...b, cliente: { id: 2, nombre: "Rosa Quispe" } })).toBe(true);
    expect(fueCorregido(t, { ...b, items: [{ ...b.items[0]!, precio: 47 }] })).toBe(true);
    expect(fueCorregido(t, { ...b, condicion: "contado", medio: "yape" })).toBe(true);
  });

  it("cambiar el comprobante que se entendió también es corregir al intérprete", () => {
    const t = venta({ comprobante: "factura" });
    expect(fueCorregido(t, { ...borradorDe(t), comprobante: "boleta" })).toBe(true);
    expect(fueCorregido(t, { ...borradorDe(t), comprobante: "ninguno" })).toBe(true);
    expect(fueCorregido(t, borradorDe(t))).toBe(false);
  });
});

describe("el comprobante no frena la venta", () => {
  it("una factura sin cliente, o a uno sin RUC, no bloquea guardar la venta: lo dictado no se pierde (la factura se dice aparte)", () => {
    const sinCliente: Borrador = { ...borradorDe(venta({ condicion: "contado", medio: "efectivo", cliente: { dicho: null, elegido: null, opciones: [] } })), comprobante: "factura" };
    expect(faltaDe(sinCliente)).toEqual([]);
    expect(pedidoVenta(sinCliente, 7, false)).not.toBeNull();
  });
});

describe("pedidoVenta", () => {
  it("arma lo que recibe registrar_venta, con la rebaja repartida", () => {
    const t = venta({
      descuento: 10,
      items: [
        { producto: { dicho: "mango", elegido: { id: 10, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 },
        { producto: { dicho: "uva", elegido: { id: 11, nombre: "Uva Bolón" }, opciones: [] }, cantidad: 2, precio: { valor: 75, sugerido: false }, subtotal: 150 },
      ],
    });
    expect(pedidoVenta(borradorDe(t), 33, false)).toEqual({
      cliente_id: 1,
      condicion: "credito",
      medio_pago: null,
      comando_voz_id: 33,
      corregido: false,
      items: [
        { producto_id: 10, cantidad: 10, precio_unitario: 45, descuento: 7.5 },
        { producto_id: 11, cantidad: 2, precio_unitario: 75, descuento: 2.5 },
      ],
    });
  });

  it("al contado lleva medio; si algo falta, no hay pedido", () => {
    const t = venta({ condicion: null });
    expect(pedidoVenta(borradorDe(t), 1, false)).toBeNull();
    expect(pedidoVenta({ ...borradorDe(t), condicion: "contado", medio: "plin" }, 1, true)).toMatchObject({ condicion: "contado", medio_pago: "plin", corregido: true });
  });
});

describe("leerPrecio", () => {
  it("lee 45, 47.50, 47,5 y S/ 45", () => {
    expect(leerPrecio("45")).toEqual({ ok: true, valor: 45 });
    expect(leerPrecio("47.50")).toEqual({ ok: true, valor: 47.5 });
    expect(leerPrecio("47,5")).toEqual({ ok: true, valor: 47.5 });
    expect(leerPrecio(" S/ 45 ")).toEqual({ ok: true, valor: 45 });
  });

  it("vacío no es error: falta el precio", () => {
    expect(leerPrecio("  ")).toEqual({ ok: false, error: null });
  });

  it("nunca adivina: negativo, tres decimales, separador de miles o texto se rechazan", () => {
    expect(leerPrecio("-5")).toEqual({ ok: false, error: "El precio no puede ser negativo." });
    expect(leerPrecio("1,299")).toEqual({ ok: false, error: "Escribe el precio así: 45 o 47.50." });
    expect(leerPrecio("1,299.50")).toMatchObject({ ok: false });
    expect(leerPrecio("45 soles")).toMatchObject({ ok: false });
  });

  it("cero o un monto absurdo se rechazan", () => {
    expect(leerPrecio("0")).toEqual({ ok: false, error: "El precio tiene que ser más que cero." });
    expect(leerPrecio("999999")).toMatchObject({ ok: false, error: expect.stringContaining("demasiado") });
  });
});

describe("ventaActual", () => {
  it("la tarjeta en los campos de registrar_venta: lo que el intérprete copia al corregir", () => {
    const b = {
      cliente: { id: 1, nombre: "Luis Paredes" },
      items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: true }],
      descuento: 0,
      condicion: "contado" as const,
      medio: null,
      comprobante: "boleta" as const,
    };
    expect(ventaActual(b)).toEqual({
      cliente_texto: "Luis Paredes",
      items: [{ producto_texto: "Mango Kent", cantidad: 10, precio_unitario: 45 }],
      descuento_total: null,
      condicion: "contado",
      medio_pago: "efectivo",
      comprobante: "boleta",
    });
    expect(ventaActual({ ...b, cliente: null, condicion: "credito", descuento: 10 })).toMatchObject({ cliente_texto: null, medio_pago: null, descuento_total: 10 });
  });
});
