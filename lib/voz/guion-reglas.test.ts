import { describe, expect, it } from "vitest";

import { guionAbono, guionAbonoRespondido, guionCompra, guionConteo, guionCompraRespondida, guionGasto, guionMerma, relecturaPagoCompra } from "./guion-reglas";

describe("guionAbono", () => {
  it("lee quién, cuánto y cómo, y pregunta «¿Confirmo?»", () => {
    expect(guionAbono({ cliente: { id: 1, nombre: "Luis Paredes" }, monto: 200, medio: "yape" }, [])).toEqual({
      pregunta: "confirmar",
      texto: "Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?",
    });
  });

  it("sin cliente, lo pregunta (ADR-0027); con las opciones parecidas, las lee", () => {
    expect(guionAbono({ cliente: null, monto: 200, medio: "efectivo" }, [])).toEqual({
      pregunta: "falta",
      texto: "Falta el cliente. ¿Quién te pagó?",
      repregunta: "¿Quién te pagó?",
    });
    const opciones = { cliente: { dicho: "lucho", opciones: ["Luis Paredes", "Luis Pérez"] } };
    expect(guionAbono({ cliente: null, monto: 200, medio: "efectivo" }, [], opciones).texto).toBe("Falta el cliente. ¿Quién te pagó? ¿Luis Paredes o Luis Pérez?");
    expect(guionAbono({ cliente: null, monto: 200, medio: "efectivo" }, [], { cliente: { dicho: "Pocho", opciones: [] } }).texto).toBe(
      "Falta el cliente. No encontré a Pocho. ¿Quién te pagó?",
    );
  });

  it("sin monto, pregunta cuánto te dio", () => {
    expect(guionAbono({ cliente: { id: 1, nombre: "Luis Paredes" }, monto: null, medio: "efectivo" }, []).texto).toBe("Falta cuánto te dio. ¿Cuánto te dio Luis Paredes?");
  });

  it("con dudas no se confirma hablando", () => {
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
    expect(relecturaPagoCompra({ ...compra, items: [{ ...compra.items[0]!, precio: 50_000 }] }, [], { proveedor: { dicho: null, opciones: [] }, productos: [] })?.pregunta).toBe("falta");
  });

  it("«la debo», pero no se sabe a quién: repite la respuesta y pregunta a quién (ADR-0027)", () => {
    const opciones = { proveedor: { dicho: "chao", opciones: ["Agrícola Chao", "Frutos Chao"] }, productos: [] };
    expect(relecturaPagoCompra({ ...compra, proveedor: null }, [], opciones)).toEqual({
      pregunta: "falta",
      texto: "La debes. ¿A quién se la compraste? ¿Agrícola Chao o Frutos Chao?",
      entera: "Falta el proveedor. ¿A quién se la compraste? ¿Agrícola Chao o Frutos Chao?",
      repregunta: "¿A quién se la compraste? ¿Agrícola Chao o Frutos Chao?",
    });
  });

  it("con el costo sugerido lo dice; con dudas, no se confirma hablando", () => {
    expect(guionCompra({ ...compra, items: [{ ...compra.items[0]!, sugerido: true }] }, []).texto).toContain("a 25 la caja, costo sugerido.");
    expect(guionCompra(compra, ["¿Isla o seda?"])).toMatchObject({ pregunta: "ninguna" });
  });
});

describe("compra: lo que falta (ADR-0027)", () => {
  const compra = {
    proveedor: { id: 2, nombre: "Agrícola Chao" },
    items: [{ productoId: 3, producto: "Plátano Isla", cantidad: 50, precio: 25, sugerido: false }],
    condicion: "credito" as const,
    medio: null,
  };
  const sinOpciones = { proveedor: { dicho: null, opciones: [] }, productos: [] };

  it("sin costo: dice lo que falta y pregunta a cuánto te costó", () => {
    expect(guionCompra({ ...compra, items: [{ ...compra.items[0]!, precio: null }], condicion: null }, [])).toEqual({
      pregunta: "falta",
      texto: "Falta el costo y si la pagaste. ¿A cuánto te costó la caja de Plátano Isla?",
      repregunta: "¿A cuánto te costó la caja de Plátano Isla?",
    });
  });

  it("la fruta con opciones: cuál de ellas", () => {
    const b = { ...compra, items: [{ ...compra.items[0]!, productoId: null, producto: "plátano" }] };
    const opciones = { proveedor: sinOpciones.proveedor, productos: [{ dicho: "plátano", opciones: ["Plátano Isla", "Plátano de seda"] }] };
    expect(guionCompra(b, [], opciones).texto).toBe("Falta la fruta. Las 50 cajas de plátano, ¿cuál es? ¿Plátano Isla o Plátano de seda?");
  });

  it("respondido el costo, si solo falta si la pagaste, «Anotado» y la compra entera con la pregunta", () => {
    const antes = { ...compra, items: [{ ...compra.items[0]!, precio: null }], condicion: null };
    expect(guionCompraRespondida(antes, { ...compra, condicion: null }, [], sinOpciones, "falta")).toEqual({
      pregunta: "pago",
      texto: "Anotado. Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. ¿La pagaste o la debes?",
      entera: "Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. ¿La pagaste o la debes?",
    });
  });

  it("una respuesta que no cambió nada no se entendió; corregir hablando dice «Corregido» y la compra entera", () => {
    const antes = { ...compra, items: [{ ...compra.items[0]!, precio: null }] };
    expect(guionCompraRespondida(antes, antes, [], sinOpciones, "falta")).toMatchObject({ pregunta: "falta", sinCambio: true });
    expect(guionCompraRespondida(compra, { ...compra, items: [{ ...compra.items[0]!, cantidad: 40 }] }, [], sinOpciones, "confirmar").texto).toBe(
      "Corregido. Compra a Agrícola Chao: 40 cajas de Plátano Isla, a 25 la caja. Total, 1000 soles. La debes. ¿Confirmo?",
    );
  });
});

describe("abono: lo que falta y corregir (ADR-0027)", () => {
  const luis = { id: 1, nombre: "Luis Paredes" };
  const opciones = { cliente: { dicho: "lucho", opciones: ["Luis Paredes", "Luis Pérez"] } };

  it("respondido el cliente, «Anotado» y el abono entero", () => {
    expect(guionAbonoRespondido({ cliente: null, monto: 200, medio: "yape" }, { cliente: luis, monto: 200, medio: "yape" }, [], opciones, "falta")).toEqual({
      pregunta: "confirmar",
      texto: "Anotado. Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?",
      entera: "Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?",
    });
  });

  it("corregido el monto, «Corregido» y el abono entero; sin cambio, se repregunta", () => {
    expect(guionAbonoRespondido({ cliente: luis, monto: 200, medio: "yape" }, { cliente: luis, monto: 300, medio: "yape" }, [], opciones, "confirmar").texto).toBe(
      "Corregido. Abono de Luis Paredes: 300 soles con Yape. ¿Confirmo?",
    );
    const sin = { cliente: null, monto: 200, medio: "yape" as const };
    expect(guionAbonoRespondido(sin, sin, [], opciones, "falta")).toMatchObject({ pregunta: "falta", sinCambio: true });
  });

  it("si la respuesta dejó una duda, la dice y se toca", () => {
    expect(guionAbonoRespondido({ cliente: null, monto: 200, medio: "yape" }, { cliente: luis, monto: 200, medio: "yape" }, ["¿200 o 300?"], opciones, "falta").pregunta).toBe("ninguna");
  });
});

describe("guionConteo (ADR-0027)", () => {
  const conteo = (cambios = {}) => ({ producto: { id: 1, nombre: "Mango Kent" }, contado: 18, causa: null, ...cambios });

  it("si cuadra, lo dice y pregunta", () => {
    expect(guionConteo(conteo({ contado: 20 }), 20, [])).toEqual({ pregunta: "confirmar", texto: "Contaste 20 cajas de Mango Kent. Cuadra con la app. ¿Confirmo?" });
  });

  it("con la causa dicha, dice la diferencia y por qué", () => {
    expect(guionConteo(conteo({ causa: "se_malogro" }), 20, []).texto).toBe(
      "Contaste 18 cajas de Mango Kent. La app decía 20 cajas: faltan 2 cajas, se malograron. ¿Confirmo?",
    );
    expect(guionConteo(conteo({ contado: 21, causa: "compra_sin_anotar" }), 20, []).texto).toContain("sobra 1 caja, llegaron sin anotar");
  });

  it("sin causa no se confirma hablando: se elige en la tarjeta", () => {
    expect(guionConteo(conteo(), 20, [])).toEqual({
      pregunta: "ninguna",
      texto: "Contaste 18 cajas de Mango Kent. La app decía 20 cajas: faltan 2 cajas. Elige por qué en la tarjeta.",
    });
  });

  it("una causa que no explica la diferencia tampoco vale", () => {
    expect(guionConteo(conteo({ contado: 22, causa: "se_malogro" }), 20, []).pregunta).toBe("ninguna");
  });

  it("con stock negativo no dice una cifra imposible", () => {
    expect(guionConteo(conteo({ contado: 3, causa: "compra_sin_anotar" }), -5, []).texto).toContain("La app no tenía ninguna: sobran 8 cajas");
  });

  it("con dudas, sin fruta o sin señal, no se confirma hablando", () => {
    expect(guionConteo(conteo(), 20, ["no sé si dijo 18 u 80"]).pregunta).toBe("ninguna");
    expect(guionConteo(conteo({ producto: null }), 20, []).pregunta).toBe("ninguna");
    expect(guionConteo(conteo(), null, []).texto).toContain("necesito señal");
  });
});
