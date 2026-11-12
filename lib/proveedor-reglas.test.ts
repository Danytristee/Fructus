import { describe, expect, it } from "vitest";

import {
  borradorDeProveedor,
  cambiosDeProveedor,
  despuesDelPago,
  leerApodos,
  leerPago,
  PROVEEDOR_VACIO,
  validarProveedor,
} from "./proveedor-reglas";

const chao = { ...PROVEEDOR_VACIO, nombre: "  Agrícola   Chao ", apodos: "Chao, el de chao,, CHAO", telefono: "987 654 321", ruc: "20999000103", origen: "Chao" };

describe("validarProveedor", () => {
  it("limpia espacios, apodos repetidos y deja null lo vacío", () => {
    expect(validarProveedor(chao)).toEqual({
      ok: true,
      fila: { nombre: "Agrícola Chao", alias: ["chao", "el de chao"], contacto: null, telefono: "987 654 321", ruc: "20999000103", origen: "Chao", direccion: null, notas: null },
    });
  });
  it("sin nombre no se guarda", () => {
    expect(validarProveedor(PROVEEDOR_VACIO)).toEqual({ ok: false, errores: { nombre: "Escribe el nombre del proveedor." } });
  });
  it("el RUC tiene 11 números y empieza con 10 o 20; el teléfono, solo números", () => {
    const r = validarProveedor({ ...chao, ruc: "123", telefono: "llamar a Hugo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["ruc", "telefono"]);
  });
});

describe("leerApodos", () => {
  it("quita comillas y separa por coma", () => expect(leerApodos("«el pacífico», La Importadora")).toEqual(["el pacífico", "la importadora"]));
});

describe("cambiosDeProveedor", () => {
  it("solo lo que cambió", () => {
    const antes = validarProveedor(chao);
    const ahora = validarProveedor({ ...chao, contacto: "don Wilmer" });
    if (!antes.ok || !ahora.ok) throw new Error("no valida");
    expect(cambiosDeProveedor(antes.fila, ahora.fila)).toEqual({ contacto: "don Wilmer" });
    expect(cambiosDeProveedor(antes.fila, antes.fila)).toEqual({});
    expect(borradorDeProveedor(antes.fila).apodos).toBe("chao, el de chao");
  });
});

describe("leerPago y despuesDelPago", () => {
  it("lee el monto como el abono: vacío falta, cero o negativo no", () => {
    expect(leerPago("1250.50")).toEqual({ ok: true, monto: 1250.5 });
    expect(leerPago("")).toEqual({ ok: false, error: null });
    expect(leerPago("0").ok).toBe(false);
    expect(leerPago("-5").ok).toBe(false);
    expect(leerPago("500000").ok).toBe(false);
  });
  it("dice cuánto le quedas debiendo, que quedas al día o lo que te queda a favor", () => {
    expect(despuesDelPago(1331, 1000)).toEqual({ tipo: "debe", monto: 331 });
    expect(despuesDelPago(0.3, 0.1 + 0.2)).toEqual({ tipo: "al_dia", monto: 0 });
    expect(despuesDelPago(100, 150)).toEqual({ tipo: "a_favor", monto: 50 });
  });
});
