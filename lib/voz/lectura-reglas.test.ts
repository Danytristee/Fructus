import { describe, expect, it } from "vitest";

import type { Borrador } from "./confirmar-venta-reglas";
import { cajasHabladas, dudaHablada, guionCorreccion, guionVenta, lecturaVenta, nombreHablado, relecturaPago, solesHablados } from "./lectura-reglas";

const venta = (cambios: Partial<Borrador> = {}): Borrador => ({
  cliente: { id: 1, nombre: "Luis Paredes" },
  items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: false }],
  descuento: 0,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  ...cambios,
});

describe("lecturaVenta", () => {
  it("lee lo que se va a guardar: cajas, fruta, precio, cliente, total y si lo debe", () => {
    expect(lecturaVenta(venta())).toBe("10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?");
  });

  it("al contado dice cómo pagó", () => {
    expect(lecturaVenta(venta({ condicion: "contado", medio: "yape" }))).toContain("Pagó con Yape.");
    expect(lecturaVenta(venta({ condicion: "contado", medio: null }))).toContain("Pagó en efectivo.");
  });

  it("el precio que no se dijo se lee como sugerido: confirmarlo es aceptarlo", () => {
    const items = [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: true }];
    expect(lecturaVenta(venta({ items }))).toContain("a 45 la caja, precio sugerido, para Luis Paredes");
  });

  it("con varias frutas, cada una con su precio, y el total de todo", () => {
    const items = [
      { productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: false },
      { productoId: 2, producto: "Palta Fuerte", cantidad: 5, precio: 60, sugerido: true },
    ];
    expect(lecturaVenta(venta({ items }))).toBe(
      "10 cajas de Mango Kent, a 45, y 5 cajas de Palta Fuerte, a 60, precio sugerido, para Luis Paredes. Total, 750 soles. Lo debe. ¿Confirmo?",
    );
  });

  it("sin cliente es un cliente de paso; la rebaja y el comprobante también se dicen", () => {
    const leida = lecturaVenta(venta({ cliente: null, condicion: "contado", medio: "efectivo", descuento: 10, comprobante: "boleta" }));
    expect(leida).toBe("10 cajas de Mango Kent, a 45 la caja, para un cliente de paso. Total, 440 soles, con 10 soles de rebaja. Pagó en efectivo. Con boleta. ¿Confirmo?");
  });

  it("lo incompleto no se lee: falta saber si pagó, el precio, la fruta o a quién se le fió", () => {
    expect(lecturaVenta(venta({ condicion: null }))).toBeNull();
    expect(lecturaVenta(venta({ items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: null, sugerido: false }] }))).toBeNull();
    expect(lecturaVenta(venta({ items: [{ productoId: null, producto: "mango", cantidad: 10, precio: 45, sugerido: false }] }))).toBeNull();
    expect(lecturaVenta(venta({ cliente: null, condicion: "credito" }))).toBeNull();
  });

  it("los céntimos se dicen «con»", () => {
    const items = [{ productoId: 1, producto: "Mango Kent", cantidad: 3, precio: 45.5, sugerido: false }];
    expect(lecturaVenta(venta({ items }))).toContain("a 45 con 50 la caja, para Luis Paredes. Total, 136 soles con 50.");
  });
});

describe("cómo se dicen los datos", () => {
  it("cajas", () => {
    expect(cajasHabladas(1)).toBe("1 caja");
    expect(cajasHabladas(10)).toBe("10 cajas");
    expect(cajasHabladas(0.5)).toBe("media caja");
    expect(cajasHabladas(1.5)).toBe("1 caja y media");
    expect(cajasHabladas(2.5)).toBe("2 cajas y media");
  });

  it("soles, sin separador de miles", () => {
    expect(solesHablados(1)).toBe("1 sol");
    expect(solesHablados(1250)).toBe("1250 soles");
    expect(solesHablados(0.5)).toBe("0 soles con 50");
    expect(solesHablados(45.05)).toBe("45 soles con 05");
  });

  it("el nombre de la fruta, como se habla", () => {
    expect(nombreHablado("Manzana Roja americana Premium cal. 113")).toBe("Manzana Roja americana Premium calibre 113");
    expect(nombreHablado("Manzana Delicia nacional 6ta")).toBe("Manzana Delicia nacional sexta");
    expect(nombreHablado("Mandarina 1era")).toBe("Mandarina primera");
  });
});

describe("relecturaPago", () => {
  it("después de «¿Pagó o lo debe?» solo repite la respuesta y pregunta: la venta se acaba de leer", () => {
    expect(relecturaPago(venta())).toEqual({ texto: "Lo debe. ¿Confirmo?", entera: lecturaVenta(venta()) });
    expect(relecturaPago(venta({ condicion: "contado", medio: "yape" }))?.texto).toBe("Pagó con Yape. ¿Confirmo?");
  });

  it("el comprobante no se dijo al preguntar: va en la respuesta corta", () => {
    expect(relecturaPago(venta({ comprobante: "factura" }))?.texto).toBe("Lo debe. Con factura. ¿Confirmo?");
  });

  it("si todavía falta algo, no hay nada que leer", () => {
    expect(relecturaPago(venta({ condicion: null }))).toBeNull();
    expect(relecturaPago(venta({ cliente: null, condicion: "credito" }))).toBeNull();
  });
});

describe("guionCorreccion", () => {
  const mango = { productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 45, sugerido: false };
  const palta = { productoId: 2, producto: "Palta Fuerte", cantidad: 4, precio: 60, sugerido: false };

  it("«no, son ocho cajas»: solo esa fruta y el total nuevo, no la venta entera", () => {
    const ocho = venta({ items: [{ ...mango, cantidad: 8 }] });
    expect(guionCorreccion(venta(), ocho, [])).toEqual({
      pregunta: "confirmar",
      texto: "Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles. ¿Confirmo?",
      entera: lecturaVenta(ocho),
    });
  });

  it("con varias frutas, solo la que cambió", () => {
    const antes = venta({ items: [mango, palta] });
    const despues = venta({ items: [mango, { ...palta, precio: 55 }] });
    expect(guionCorreccion(antes, despues, []).texto).toBe("Corregido. 4 cajas de Palta Fuerte, a 55. Total, 670 soles. ¿Confirmo?");
  });

  it("si cambió cuántas frutas hay, las dice todas", () => {
    expect(guionCorreccion(venta(), venta({ items: [mango, palta] }), []).texto).toBe(
      "Corregido. 10 cajas de Mango Kent, a 45, y 4 cajas de Palta Fuerte, a 60. Total, 690 soles. ¿Confirmo?",
    );
  });

  it("otro cliente con el mismo precio: el cliente, sin total (no cambió el dinero)", () => {
    expect(guionCorreccion(venta(), venta({ cliente: { id: 7, nombre: "Pedro Díaz" } }), []).texto).toBe("Corregido. Para Pedro Díaz. ¿Confirmo?");
  });

  it("la rebaja, el pago y el comprobante, cuando cambian", () => {
    expect(guionCorreccion(venta(), venta({ descuento: 10 }), []).texto).toBe("Corregido. Con 10 soles de rebaja. Total, 440 soles. ¿Confirmo?");
    expect(guionCorreccion(venta({ descuento: 10 }), venta(), []).texto).toBe("Corregido. Sin rebaja. Total, 450 soles. ¿Confirmo?");
    expect(guionCorreccion(venta(), venta({ condicion: "contado", medio: "yape" }), []).texto).toBe("Corregido. Pagó con Yape. ¿Confirmo?");
    expect(guionCorreccion(venta({ condicion: "contado", medio: "efectivo" }), venta({ condicion: "contado", medio: "plin" }), []).texto).toBe(
      "Corregido. Pagó con Plin. ¿Confirmo?",
    );
    expect(guionCorreccion(venta(), venta({ comprobante: "boleta" }), []).texto).toBe("Corregido. Con boleta. ¿Confirmo?");
  });

  it("si todavía no se sabe si pagó, lo corregido y la pregunta del pago", () => {
    const antes = venta({ condicion: null });
    expect(guionCorreccion(antes, venta({ condicion: null, items: [{ ...mango, precio: 40 }] }), [])).toMatchObject({
      pregunta: "pago",
      texto: "Corregido. 10 cajas de Mango Kent, a 40 la caja. Total, 400 soles. ¿Pagó o lo debe?",
    });
  });

  it("si no cambió nada que se pueda nombrar, lee la venta entera: tiene que oír qué quedó", () => {
    expect(guionCorreccion(venta(), venta(), [])).toEqual({ pregunta: "confirmar", texto: lecturaVenta(venta()), entera: lecturaVenta(venta()) });
  });

  it("con dudas o si falta un dato, igual que al dictar: se mira la tarjeta", () => {
    expect(guionCorreccion(venta(), venta({ items: [{ ...mango, cantidad: 8 }] }), ["No sé si dijo 8 o 18."])).toMatchObject({ pregunta: "ninguna" });
    expect(guionCorreccion(venta(), venta({ items: [{ ...mango, precio: null }] }), [])).toMatchObject({ pregunta: "ninguna" });
  });
});

describe("guionVenta", () => {
  it("lista para guardar: la lee y pregunta «¿Confirmo?»", () => {
    expect(guionVenta(venta(), [])).toEqual({ pregunta: "confirmar", texto: lecturaVenta(venta()) });
  });

  it("si solo falta saber si pagó, lo pregunta por voz: nunca se asume contado", () => {
    expect(guionVenta(venta({ condicion: null }), [])).toEqual({
      pregunta: "pago",
      texto: "10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. ¿Pagó o lo debe?",
    });
  });

  it("con dudas del intérprete no se confirma hablando: pide el toque", () => {
    expect(guionVenta(venta(), ["No sé si dijo 10 o 12 cajas."])).toEqual({
      pregunta: "ninguna",
      texto: "Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la tarjeta y toca Confirmar.",
    });
  });

  it("la duda se dice, y si hay varias, cuántas más: no hay que soltar las cajas para saber cuál es", () => {
    expect(dudaHablada(["¿Mango Kent o Edward?", "No dijo el precio"])).toBe("Tengo una duda: ¿Mango Kent o Edward?, y una más. Revisa la tarjeta y toca Confirmar.");
    expect(dudaHablada(["A", "B", "C"])).toBe("Tengo una duda: a, y 2 más. Revisa la tarjeta y toca Confirmar.");
  });

  it("si falta otra cosa, dice qué y se elige en la tarjeta", () => {
    const sinPrecio = venta({ items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: null, sugerido: false }], condicion: null });
    expect(guionVenta(sinPrecio, [])).toEqual({ pregunta: "ninguna", texto: "Falta elegir a cuánto la caja y si pagó o lo debe. Míralo en la tarjeta." });
  });
});
