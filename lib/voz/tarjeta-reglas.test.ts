import { describe, expect, it } from "vitest";

import { leerInterpretacion, type Interpretacion } from "./esquemas";
import { armarTarjeta, elegir, type Resolucion } from "./tarjeta-reglas";

const interpretar = (herramienta: string, datos: unknown): Interpretacion => {
  const r = leerInterpretacion(herramienta, datos);
  if (!r.ok) throw new Error(r.motivo);
  return r.interpretacion;
};

const lucho = { id: 1, nombre: "Luis Paredes", similitud: 0.9 };
const royal = { id: 10, nombre: "Manzana Royal", similitud: 1 };
const nada: Resolucion = { clientes: [], proveedores: [], productos: [], precios: [] };

describe("elegir", () => {
  it("con 0.45 o más se elige solo", () => {
    expect(elegir("don lucho", [lucho])).toEqual({ dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] });
  });

  it("por debajo de 0.45 ofrece las 3 mejores, de la más parecida a la menos", () => {
    const e = elegir("el gordo", [
      { id: 1, nombre: "A", similitud: 0.2 },
      { id: 2, nombre: "B", similitud: 0.4 },
      { id: 3, nombre: "C", similitud: 0.1 },
      { id: 4, nombre: "D", similitud: 0.3 },
    ]);
    expect(e.elegido).toBeNull();
    expect(e.opciones.map((o) => o.id)).toEqual([2, 4, 1]);
  });

  it("si dos calzan casi igual, pregunta aunque pasen de 0.45: «manzana verde» es Premium o Comercial", () => {
    const e = elegir("manzana verde", [
      { id: 1, nombre: "Manzana Verde Premium cal. 100", similitud: 0.64 },
      { id: 2, nombre: "Manzana Verde Comercial cal. 80 o 75", similitud: 0.58 },
      { id: 3, nombre: "Manzana Buena", similitud: 0.42 },
    ]);
    expect(e.elegido).toBeNull();
    expect(e.opciones.map((o) => o.id)).toEqual([1, 2, 3]);
  });

  it("con un empate exacto también pregunta: nunca se elige al azar", () => {
    const e = elegir("roja americana", [
      { id: 1, nombre: "Manzana Roja americana Premium cal. 100", similitud: 0.79 },
      { id: 2, nombre: "Manzana Roja americana Premium cal. 113", similitud: 0.79 },
    ]);
    expect(e.elegido).toBeNull();
  });

  it("si el mejor le saca ventaja al segundo, elige solo", () => {
    const e = elegir("membrillo cuarta", [
      { id: 4, nombre: "Membrillo 4ta", similitud: 0.85 },
      { id: 5, nombre: "Membrillo 5ta", similitud: 0.55 },
    ]);
    expect(e.elegido).toEqual({ id: 4, nombre: "Membrillo 4ta" });
  });

  it("si no se dijo nada, no elige ni ofrece", () => {
    expect(elegir(null, [lucho])).toEqual({ dicho: null, elegido: null, opciones: [] });
  });
});

describe("armarTarjeta · venta", () => {
  const venta = (extra: object) =>
    interpretar("registrar_venta", {
      cliente_texto: "don Lucho",
      items: [{ producto_texto: "manzana royal", cantidad: 10, precio_unitario: null }],
      condicion: null,
      medio_pago: null,
      ...extra,
    });

  it("el precio que no se dijo sale del último cobrado y se marca sugerido; el total se calcula", () => {
    const t = armarTarjeta(venta({}), { ...nada, clientes: [lucho], productos: [[royal]], precios: [128.7] });
    expect(t.tipo).toBe("venta");
    if (t.tipo !== "venta") return;
    expect(t.items[0]!.precio).toEqual({ valor: 128.7, sugerido: true });
    expect(t.items[0]!.subtotal).toBe(1287);
    expect(t.total).toBe(1287);
  });

  it("si no dijo si pagó, se pregunta: la condición queda en null y falta", () => {
    const t = armarTarjeta(venta({}), { ...nada, clientes: [lucho], productos: [[royal]], precios: [128.7] });
    expect(t.tipo === "venta" && t.condicion).toBeNull();
    expect(t.tipo === "venta" && t.falta).toEqual(["condicion"]);
  });

  it("el precio dicho manda sobre el sugerido y no se marca", () => {
    const t = armarTarjeta(venta({ items: [{ producto_texto: "manzana royal", cantidad: 10, precio_unitario: 125 }] }), {
      ...nada,
      clientes: [lucho],
      productos: [[royal]],
      precios: [128.7],
    });
    expect(t.tipo === "venta" && t.items[0]!.precio).toEqual({ valor: 125, sugerido: false });
  });

  it("sin precio dicho ni sugerido, no hay total: nunca se inventa", () => {
    const t = armarTarjeta(venta({}), { ...nada, clientes: [lucho], productos: [[royal]], precios: [null] });
    if (t.tipo !== "venta") throw new Error("no es venta");
    expect(t.items[0]!.precio).toEqual({ valor: null, sugerido: false });
    expect(t.total).toBeNull();
    expect(t.falta).toContain("precio");
  });

  it("si el producto no se eligió solo, no se sugiere precio aunque haya uno", () => {
    const dudoso = { id: 11, nombre: "Manzana Roja", similitud: 0.3 };
    const t = armarTarjeta(venta({}), { ...nada, clientes: [lucho], productos: [[dudoso]], precios: [128.7] });
    if (t.tipo !== "venta") throw new Error("no es venta");
    expect(t.items[0]!.producto.elegido).toBeNull();
    expect(t.items[0]!.precio.valor).toBeNull();
    expect(t.falta).toEqual(expect.arrayContaining(["producto", "precio"]));
  });

  it("al crédito sin cliente reconocido falta el cliente", () => {
    const t = armarTarjeta(venta({ condicion: "credito" }), { ...nada, clientes: [{ id: 9, nombre: "X", similitud: 0.1 }], productos: [[royal]], precios: [128.7] });
    expect(t.tipo === "venta" && t.falta).toContain("cliente");
  });

  it("al contado sin medio es en efectivo, y el descuento se resta del total", () => {
    const t = armarTarjeta(venta({ condicion: "contado", descuento_total: 20, items: [{ producto_texto: "manzana royal", cantidad: 2, precio_unitario: 130 }] }), {
      ...nada,
      clientes: [lucho],
      productos: [[royal]],
      precios: [128.7],
    });
    if (t.tipo !== "venta") throw new Error("no es venta");
    expect(t.medio).toBe("efectivo");
    expect(t.total).toBe(240);
    expect(t.falta).toEqual([]);
  });
});

describe("armarTarjeta · lo demás", () => {
  it("un abono sin cliente reconocido pide elegirlo", () => {
    const t = armarTarjeta(interpretar("registrar_abono", { cliente_texto: "el gordo", monto: 100, medio_pago: "efectivo" }), nada);
    expect(t).toMatchObject({ tipo: "abono", monto: 100, falta: ["cliente"] });
  });

  it("una compra sin costo ni costo anterior lo pide, y sin decir si se pagó, lo pregunta", () => {
    const t = armarTarjeta(
      interpretar("registrar_compra", { proveedor_texto: null, items: [{ producto_texto: "manzana royal", cantidad: 40, costo_unitario: null }], condicion: null }),
      { ...nada, productos: [[royal]] },
    );
    expect(t).toMatchObject({ tipo: "compra", items: [{ costo: { valor: null, sugerido: false } }], falta: ["costo", "condicion"] });
  });

  it("una compra sin costo dicho sugiere el último y lo marca; nunca asume contado", () => {
    const t = armarTarjeta(
      interpretar("registrar_compra", { proveedor_texto: null, items: [{ producto_texto: "manzana royal", cantidad: 40, costo_unitario: null }], condicion: null }),
      { ...nada, productos: [[royal]], precios: [95] },
    );
    expect(t).toMatchObject({ tipo: "compra", items: [{ costo: { valor: 95, sugerido: true } }], condicion: null, falta: ["condicion"] });
  });

  it("una compra al crédito pide a quién se le debe", () => {
    const t = armarTarjeta(
      interpretar("registrar_compra", { proveedor_texto: null, items: [{ producto_texto: "manzana royal", cantidad: 40, costo_unitario: 90 }], condicion: "credito" }),
      { ...nada, productos: [[royal]] },
    );
    expect(t).toMatchObject({ tipo: "compra", items: [{ costo: { valor: 90, sugerido: false } }], falta: ["proveedor"] });
  });

  it("no entendido dice qué hacer, en lenguaje de puesto", () => {
    expect(armarTarjeta(interpretar("no_entendido", { motivo: "x" }), nada)).toEqual({ tipo: "no_entendido", mensaje: "No te entendí, inténtalo otra vez." });
  });
});
