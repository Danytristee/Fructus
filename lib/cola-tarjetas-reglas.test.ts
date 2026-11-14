import { describe, expect, it } from "vitest";

import type { Entrada, Operacion } from "./cola-reglas";
import { queEsLaTarjeta, tarjetaParaAnotar, ventasPorEnviar } from "./cola-tarjetas-reglas";
import { formatearCajas, formatearSoles } from "./formato";

const lucho = { id: 1, nombre: "Don Lucho" };
const venta: Operacion = {
  tipo: "venta",
  entrada: {
    comandoId: 7,
    corregido: false,
    latenciaMs: 0,
    borrador: { cliente: lucho, items: [{ productoId: 3, producto: "Mango Kent", cantidad: 3, precio: 40, sugerido: false }], descuento: 0, condicion: "credito", medio: null },
  },
};
const abono: Operacion = { tipo: "abono", entrada: { comandoId: 8, corregido: false, latenciaMs: 0, borrador: { cliente: lucho, monto: 20, medio: "yape" } } };
const entrada = (op: Operacion, estado: "pendiente" | "rechazada" = "pendiente"): Entrada => ({
  id: 1, usuarioId: "u", creadoEn: 0, estado, resumen: "", contenido: { clase: "confirmacion", operacion: op },
});

describe("queEsLaTarjeta", () => {
  const lucho = { dicho: "lucho", elegido: { id: 1, nombre: "Don Lucho" }, opciones: [] };
  it("un abono dice de quién y cuánto", () => expect(queEsLaTarjeta({ tipo: "abono", cliente: lucho, monto: 50 })).toBe(`tu abono de Don Lucho · ${formatearSoles(50)}`));
  it("una venta dice a quién y el total", () => expect(queEsLaTarjeta({ tipo: "venta", cliente: lucho, total: 120 })).toBe(`tu venta a Don Lucho · ${formatearSoles(120)}`));
  it("sin elegir, usa lo que se dijo", () => expect(queEsLaTarjeta({ tipo: "abono", cliente: { dicho: "el flaco", elegido: null, opciones: [] }, monto: null })).toBe("tu abono del flaco"));
  it("una merma dice la fruta y las cajas", () =>
    expect(queEsLaTarjeta({ tipo: "merma", producto: { dicho: null, elegido: { id: 2, nombre: "Palta" }, opciones: [] }, cantidad: 2 })).toBe(`tu merma de Palta · ${formatearCajas(2)}`));
  it("lo que no reconoce no rompe", () => expect(queEsLaTarjeta(null)).toBe("lo que dictaste"));
});

describe("tarjetaParaAnotar", () => {
  it("si el cliente ya no está, el abono vuelve con su monto y medio, y el cliente por elegir", () => {
    expect(tarjetaParaAnotar(abono, "Ese cliente ya no está en tu cuaderno. Elige a otro.")).toEqual({
      tipo: "abono",
      cliente: { dicho: "Don Lucho", elegido: null, opciones: [] },
      monto: 20,
      medio: "yape",
      dudas: [],
      falta: ["cliente"],
    });
  });

  it("si el rechazo no es por el cliente, lo deja elegido", () => {
    const t = tarjetaParaAnotar(abono, "Tu cuenta no puede registrar abonos.");
    expect(t).toMatchObject({ cliente: { elegido: lucho }, falta: [] });
  });

  it("la venta al crédito sin cliente lo pide, y conserva frutas, cajas y precios", () => {
    const t = tarjetaParaAnotar(venta, "Ese cliente ya no está en tu cuaderno. Elige a otro.");
    expect(t).toMatchObject({
      tipo: "venta",
      cliente: { dicho: "Don Lucho", elegido: null },
      items: [{ producto: { elegido: { id: 3, nombre: "Mango Kent" } }, cantidad: 3, precio: { valor: 40, sugerido: false }, subtotal: 120 }],
      total: 120,
      condicion: "credito",
      falta: ["cliente"],
    });
  });

  it("si la fruta ya no está, la deja por elegir", () => {
    const t = tarjetaParaAnotar(venta, "Esa fruta ya no está en tu catálogo. Elige otra.");
    expect(t).toMatchObject({ items: [{ producto: { dicho: "Mango Kent", elegido: null } }], falta: ["producto"] });
  });
});

describe("ventasPorEnviar", () => {
  it("cuenta y suma solo las ventas pendientes", () => {
    expect(ventasPorEnviar([entrada(venta), entrada(venta), entrada(abono), entrada(venta, "rechazada")])).toEqual({ cuantas: 2, total: 240 });
  });
  it("sin ventas, cero", () => expect(ventasPorEnviar([])).toEqual({ cuantas: 0, total: 0 }));
});
