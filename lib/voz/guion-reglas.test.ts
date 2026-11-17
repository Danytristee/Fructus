import { describe, expect, it } from "vitest";

import { guionAbono, guionCompra, guionGasto, guionMerma, relecturaPagoCompra } from "./guion-reglas";

describe("guionAbono", () => {
  it("lee quién, cuánto y cómo, y pregunta «¿Confirmo?»", () => {
    expect(guionAbono({ cliente: { id: 1, nombre: "Luis Paredes" }, monto: 200, medio: "yape" }, [])).toEqual({
      pregunta: "confirmar",
      texto: "Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?",
    });
  });

  it("sin cliente o con dudas no se confirma hablando", () => {
    expect(guionAbono({ cliente: null, monto: 200, medio: "efectivo" }, [])).toMatchObject({ pregunta: "ninguna" });
    expect(guionAbono({ cliente: { id: 1, nombre: "Luis Paredes" }, monto: 200, medio: "efectivo" }, ["¿200 o 300?"])).toEqual({
      pregunta: "ninguna",
      texto: "Tengo una duda: ¿200 o 300? Revisa la tarjeta y toca Confirmar.",
    });
  });
});

describe("guionMerma", () => {
  it("lee las cajas, la fruta y el motivo", () => {
    expect(guionMerma({ producto: { id: 1, nombre: "Mango Kent" }, cantidad: 3, motivo: "se malograron." })).toEqual({
      pregunta: "confirmar",
      texto: "Merma: 3 cajas de Mango Kent, se malograron. ¿Confirmo?",
    });
    expect(guionMerma({ producto: { id: 1, nombre: "Papaya" }, cantidad: 1, motivo: null }).texto).toBe("Merma: 1 caja de Papaya. ¿Confirmo?");
  });

  it("sin la fruta, dice qué falta", () => {
    expect(guionMerma({ producto: null, cantidad: 3, motivo: null })).toMatchObject({ pregunta: "ninguna" });
  });
});

describe("guionGasto", () => {
  it("lee en qué, cuánto y cómo", () => {
    expect(guionGasto({ categoria: "flete", monto: 50, descripcion: "al cargador", medio: "efectivo" })).toEqual({
      pregunta: "confirmar",
      texto: "Gasto de flete, al cargador: 50 soles en efectivo. ¿Confirmo?",
    });
  });
});

describe("guionCompra", () => {
  const compra = {
    proveedor: { id: 2, nombre: "Agrícola Chao" },
    items: [{ productoId: 3, producto: "Plátano Isla", cantidad: 50, precio: 25, sugerido: false }],
    condicion: "credito" as const,
    medio: null,
  };

  it("lista: la lee con el total y si la debes", () => {
    expect(guionCompra(compra, [])).toEqual({
      pregunta: "confirmar",
      texto: "Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. La debes. ¿Confirmo?",
    });
  });

  it("si no dijo si la pagó, lo pregunta: nunca se asume contado", () => {
    expect(guionCompra({ ...compra, condicion: null }, [])).toEqual({
      pregunta: "pago",
      texto: "Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. ¿La pagaste o la debes?",
    });
  });

  it("después de responder si la pagó, solo repite la respuesta: la compra se acaba de leer", () => {
    expect(relecturaPagoCompra(compra, [])).toEqual({ pregunta: "confirmar", texto: "La debes. ¿Confirmo?", entera: guionCompra(compra, []).texto });
    expect(relecturaPagoCompra({ ...compra, condicion: "contado", medio: "plin" }, [])?.texto).toBe("La pagaste con Plin. ¿Confirmo?");
    expect(relecturaPagoCompra({ ...compra, items: [{ ...compra.items[0]!, precio: null }] }, [])).toBeNull();
  });

  it("con el costo sugerido lo dice; sin costo o con dudas, no se confirma hablando", () => {
    expect(guionCompra({ ...compra, items: [{ ...compra.items[0]!, sugerido: true }] }, []).texto).toContain("a 25 la caja, costo sugerido.");
    expect(guionCompra({ ...compra, items: [{ ...compra.items[0]!, precio: null }] }, [])).toMatchObject({ pregunta: "ninguna" });
    expect(guionCompra(compra, ["¿Isla o seda?"])).toMatchObject({ pregunta: "ninguna" });
  });
});
