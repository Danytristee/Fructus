import { describe, expect, it } from "vitest";

import type { Borrador } from "./confirmar-venta-reglas";
import { cajasHabladas, nombreHablado, solesHablados } from "./hablado-reglas";
import { cambiosDeCorreccion, dudaHablada, guionCompletado, guionCorreccion, guionVenta, lecturaVenta, relecturaPago } from "./lectura-reglas";

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

  it("con pago parcial dice cuánto pagó, cómo y cuánto queda debiendo (ADR-0025)", () => {
    const items = [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: 500, sugerido: false }];
    expect(lecturaVenta(venta({ items, pagado: 1000, medio: "yape" }))).toBe(
      "10 cajas de Mango Kent, a 500 la caja, para Luis Paredes. Total, 5000 soles. Pagó 1000 soles con Yape y debe 4000 soles. ¿Confirmo?",
    );
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
    expect(relecturaPago(venta())).toEqual({ pregunta: "confirmar", texto: "Lo debe. ¿Confirmo?", entera: lecturaVenta(venta()) });
    expect(relecturaPago(venta({ condicion: "contado", medio: "yape" }))?.texto).toBe("Pagó con Yape. ¿Confirmo?");
  });

  it("el comprobante no se dijo al preguntar: va en la respuesta corta", () => {
    expect(relecturaPago(venta({ comprobante: "factura" }))?.texto).toBe("Lo debe. Con factura. ¿Confirmo?");
  });

  it("si todavía falta saber si pagó o algo que se elige en la tarjeta, no hay nada que leer", () => {
    expect(relecturaPago(venta({ condicion: null }))).toBeNull();
    expect(relecturaPago(venta({ condicion: "credito", pagado: 900, medio: "yape" }))).toBeNull(); // pagó más que el total: se elige a mano
  });

  it("«lo debe», pero no se sabe quién: repite la respuesta y pregunta a quién (ADR-0027)", () => {
    expect(relecturaPago(venta({ cliente: null, condicion: "credito" }))).toEqual({
      pregunta: "falta",
      texto: "Lo debe. ¿A quién se lo fiaste?",
      entera: "Falta el cliente. ¿A quién se lo fiaste?",
      repregunta: "¿A quién se lo fiaste?",
    });
    const opciones = { cliente: { dicho: "lucho", opciones: ["Luis Paredes", "Luis Pérez"] }, productos: [] };
    expect(relecturaPago(venta({ cliente: null, condicion: "credito" }), opciones)?.texto).toBe("Lo debe. ¿Para quién es? ¿Luis Paredes o Luis Pérez?");
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

  it("cambiosDeCorreccion: lo que la tarjeta marca «corregido», lo mismo que dice la voz", () => {
    const nada = { frutas: [], cajas: [], precios: [], cliente: false, rebaja: false, total: false, pago: false, comprobante: false };
    expect(cambiosDeCorreccion(venta(), venta())).toEqual(nada);
    expect(cambiosDeCorreccion(venta(), venta({ items: [{ ...mango, cantidad: 8 }] }))).toEqual({ ...nada, frutas: [0], cajas: [0], total: true });
    expect(cambiosDeCorreccion(venta({ items: [mango, palta] }), venta({ items: [mango, { ...palta, precio: 55 }] }))).toEqual({ ...nada, frutas: [1], precios: [1], total: true });
    expect(cambiosDeCorreccion(venta(), venta({ items: [mango, palta] }))).toMatchObject({ frutas: [0, 1], cajas: [0, 1], precios: [] });
    // Cajas y precio a la vez: las dos marcas.
    expect(cambiosDeCorreccion(venta(), venta({ items: [{ ...mango, cantidad: 8, precio: 40 }] }))).toMatchObject({ cajas: [0], precios: [0] });
    expect(cambiosDeCorreccion(venta(), venta({ cliente: { id: 7, nombre: "Pedro Díaz" } }))).toEqual({ ...nada, cliente: true });
    expect(cambiosDeCorreccion(venta(), venta({ descuento: 10 }))).toEqual({ ...nada, rebaja: true, total: true });
  });

  it("con dudas, igual que al dictar: se mira la tarjeta", () => {
    expect(guionCorreccion(venta(), venta({ items: [{ ...mango, cantidad: 8 }] }), ["No sé si dijo 8 o 18."])).toMatchObject({ pregunta: "ninguna" });
  });

  it("si la corrección deja un dato por decir, dice qué falta y lo pregunta (ADR-0027)", () => {
    const opciones = { cliente: { dicho: "pedro", opciones: ["Pedro Díaz", "Pedro Ruiz"] }, productos: [] };
    expect(guionCorreccion(venta(), venta({ cliente: null }), [], opciones)).toEqual({
      pregunta: "falta",
      texto: "Corregido. Falta el cliente. ¿Para quién es? ¿Pedro Díaz o Pedro Ruiz?",
      entera: "Falta el cliente. ¿Para quién es? ¿Pedro Díaz o Pedro Ruiz?",
      repregunta: "¿Para quién es? ¿Pedro Díaz o Pedro Ruiz?",
    });
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

  it("si falta el precio, dice todo lo que falta y pregunta lo primero (ADR-0027)", () => {
    const sinPrecio = venta({ items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: null, sugerido: false }], condicion: null });
    expect(guionVenta(sinPrecio, [])).toEqual({
      pregunta: "falta",
      texto: "Falta el precio y si pagó. ¿A cuánto la caja de Mango Kent?",
      repregunta: "¿A cuánto la caja de Mango Kent?",
    });
  });

  it("con dudas no pregunta lo que falta: la duda manda y se toca", () => {
    expect(guionVenta(venta({ items: [{ ...venta().items[0]!, precio: null }] }), ["No sé si dijo Kent o Edward"]).pregunta).toBe("ninguna");
  });

  it("lo que pagó al llevar y no cuadra no se pregunta: se elige en la tarjeta", () => {
    expect(guionVenta(venta({ pagado: 900, medio: "yape" }), [])).toEqual({
      pregunta: "ninguna",
      texto: "Falta elegir cuánto pagó: menos que el total (si pagó todo, toca «Pagó»). Míralo en la tarjeta.",
    });
  });
});

describe("guionCompletado: la respuesta a lo que faltaba (ADR-0027)", () => {
  const sinPrecio = venta({ items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: null, sugerido: false }], condicion: null });

  it("si quedó lista salvo el pago, dice «Anotado» y la venta entera, que nunca se leyó completa, y pregunta si pagó", () => {
    expect(guionCompletado(sinPrecio, venta({ condicion: null }), [])).toEqual({
      pregunta: "pago",
      texto: "Anotado. 10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. ¿Pagó o lo debe?",
      entera: "10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. ¿Pagó o lo debe?",
    });
  });

  it("si quedó lista del todo, la lee entera y pregunta «¿Confirmo?»", () => {
    expect(guionCompletado(venta({ cliente: null }), venta(), [])).toMatchObject({
      pregunta: "confirmar",
      texto: "Anotado. 10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?",
    });
  });

  it("si todavía falta otro dato, «Anotado» y la pregunta siguiente, sin repetir todo lo que falta", () => {
    const sinFruta = venta({ items: [{ productoId: null, producto: "mango", cantidad: 10, precio: null, sugerido: false }] });
    const conFruta = venta({ items: [{ productoId: 1, producto: "Mango Kent", cantidad: 10, precio: null, sugerido: false }] });
    expect(guionCompletado(sinFruta, conFruta, [])).toMatchObject({ pregunta: "falta", texto: "Anotado. ¿A cuánto la caja de Mango Kent?" });
  });

  it("si la respuesta no cambió nada, no se entendió: queda para repreguntar", () => {
    expect(guionCompletado(sinPrecio, sinPrecio, [])).toMatchObject({ pregunta: "falta", sinCambio: true });
  });

  it("si la respuesta dejó una duda, la dice y se toca", () => {
    expect(guionCompletado(sinPrecio, venta({ condicion: null }), ["No sé si dijo 45 o 55"])).toMatchObject({ pregunta: "ninguna" });
  });
});
