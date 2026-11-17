import { describe, expect, it } from "vitest";

import type { Borrador } from "./confirmar-venta-reglas";
import { faltaDicha, faltaPorPreguntar, opcionesDeVenta, preguntaFalta, type OpcionesVenta } from "./pregunta-falta-reglas";

const mango = { productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: false };
const venta = (cambios: Partial<Borrador> = {}): Borrador => ({
  cliente: { id: 1, nombre: "Luis Paredes" },
  items: [mango],
  descuento: 0,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  ...cambios,
});
type Nombre = OpcionesVenta["cliente"];
const nadie: Nombre = { dicho: null, opciones: [] };
const opciones = (productos: Nombre[], cliente: Nombre = nadie): OpcionesVenta => ({ cliente, productos });

describe("faltaPorPreguntar", () => {
  it("pregunta primero la fruta, después las cajas, el precio y a quién se le fía; si pagó, no (tiene su pregunta)", () => {
    const todo = venta({ cliente: null, items: [{ ...mango, productoId: null, producto: "mango", precio: null }] });
    expect(faltaPorPreguntar(todo)).toEqual({ dato: "producto", item: 0, opciones: [] });
    expect(faltaPorPreguntar(venta({ cliente: null, items: [{ ...mango, precio: null }] }))).toEqual({ dato: "precio", item: 0, opciones: [] });
    expect(faltaPorPreguntar(venta({ cliente: null }))).toEqual({ dato: "cliente", item: null, opciones: [] });
    expect(faltaPorPreguntar(venta({ condicion: null }))).toBeNull();
    expect(faltaPorPreguntar(venta())).toBeNull();
  });

  it("dice cuál fruta: la primera a la que le falta, y sus opciones (hasta 3)", () => {
    const b = venta({ items: [mango, { ...mango, productoId: null, producto: "palta" }] });
    const o = opciones([nadie, { dicho: "palta", opciones: ["Palta Fuerte", "Palta Hass", "Palta Criolla", "Palta Naval"] }]);
    expect(faltaPorPreguntar(b, o)).toEqual({ dato: "producto", item: 1, opciones: ["Palta Fuerte", "Palta Hass", "Palta Criolla"] });
  });

  it("un precio de 0 o desorbitado también se pregunta", () => {
    expect(faltaPorPreguntar(venta({ items: [{ ...mango, precio: 0 }] }))?.dato).toBe("precio");
    expect(faltaPorPreguntar(venta({ items: [{ ...mango, precio: 50_000 }] }))?.dato).toBe("precio");
  });

  it("sin frutas, pregunta la fruta sin decir cuál", () => {
    expect(faltaPorPreguntar(venta({ items: [] }))).toEqual({ dato: "producto", item: null, opciones: [] });
  });
});

describe("preguntaFalta", () => {
  const pregunta = (b: Borrador, o = opciones([])) => preguntaFalta(b, faltaPorPreguntar(b, o)!, o);

  it("la fruta con opciones: cuál de ellas", () => {
    const b = venta({ items: [{ ...mango, productoId: null, producto: "mango" }] });
    expect(pregunta(b, opciones([{ dicho: "mango", opciones: ["Mango Kent", "Mango Edward"] }]))).toBe("Las 10 cajas de mango, ¿cuál es? ¿Mango Kent o Mango Edward?");
    expect(pregunta(b, opciones([{ dicho: "mango", opciones: ["Mango Kent", "Mango Edward", "Mango Haden"] }]))).toBe(
      "Las 10 cajas de mango, ¿cuál es? ¿Mango Kent, Mango Edward o Mango Haden?",
    );
  });

  it("la fruta sin nada parecido: dice que no la encontró", () => {
    const b = venta({ items: [{ ...mango, productoId: null, producto: "carambola", cantidad: 1 }] });
    expect(pregunta(b, opciones([{ dicho: "carambola", opciones: [] }]))).toBe("No encontré carambola. ¿Qué fruta es la caja?");
    expect(pregunta(venta({ items: [] }))).toBe("¿Qué fruta llevó, y cuántas cajas?");
  });

  it("el nombre de la opción se dice como se habla", () => {
    const b = venta({ items: [{ ...mango, productoId: null, producto: "mandarina", cantidad: 0.5 }] });
    expect(pregunta(b, opciones([{ dicho: "mandarina", opciones: ["Mandarina 1era", "Mandarina 2da"] }]))).toBe(
      "La media caja de mandarina, ¿cuál es? ¿Mandarina primera o Mandarina segunda?",
    );
  });

  it("el precio y las cajas, de qué fruta", () => {
    expect(pregunta(venta({ items: [{ ...mango, precio: null }] }))).toBe("¿A cuánto la caja de Mango Kent?");
    expect(pregunta(venta({ items: [{ ...mango, cantidad: 0 }] }))).toBe("¿Cuántas cajas de Mango Kent?");
  });

  it("a quién se le fía: con opciones, cuál; si no se encontró, lo dice", () => {
    expect(pregunta(venta({ cliente: null }), opciones([], { dicho: "lucho", opciones: ["Luis Paredes", "Luis Pérez"] }))).toBe("¿Para quién es? ¿Luis Paredes o Luis Pérez?");
    expect(pregunta(venta({ cliente: null }), opciones([], { dicho: "Pocho", opciones: [] }))).toBe("No encontré a Pocho. ¿A quién se lo fiaste?");
    expect(pregunta(venta({ cliente: null }))).toBe("¿A quién se lo fiaste?");
  });
});

describe("faltaDicha", () => {
  it("lo que falta, corto: «Falta el precio y si pagó.»", () => {
    expect(faltaDicha(["precio", "condicion"])).toBe("Falta el precio y si pagó.");
    expect(faltaDicha(["cliente", "producto", "precio"])).toBe("Falta el cliente, la fruta y el precio.");
  });
});

describe("opcionesDeVenta", () => {
  it("saca de la tarjeta lo dicho y los nombres de las opciones", () => {
    const tarjeta = {
      tipo: "venta" as const,
      cliente: { dicho: "lucho", elegido: null, opciones: [{ id: 1, nombre: "Luis Paredes" }] },
      items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
      descuento: 0,
      total: 450,
      condicion: null,
      medio: null,
      comprobante: "ninguno" as const,
      dudas: [],
      falta: [],
    };
    expect(opcionesDeVenta(tarjeta)).toEqual({ cliente: { dicho: "lucho", opciones: ["Luis Paredes"] }, productos: [{ dicho: "mango", opciones: [] }] });
  });
});
