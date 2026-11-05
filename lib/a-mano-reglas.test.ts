import { describe, expect, it } from "vitest";

import { sinSesionAMano, sugeridosParaAbono, sugeridosParaMerma, tarjetaAbonoAMano, tarjetaMermaAMano } from "./a-mano-reglas";
import { borradorAbono, faltaAbono, fueCorregidoAbono } from "./voz/confirmar-abono-reglas";
import { borradorMerma, faltaMerma, fueCorregidaMerma, pedidoMerma } from "./voz/confirmar-merma-reglas";

const rosa = { id: 2, nombre: "Rosa Quispe" };

describe("tarjetaAbonoAMano", () => {
  it("desde la ficha trae al cliente elegido, y sin monto: nunca se inventa", () => {
    const t = tarjetaAbonoAMano(rosa);
    expect(t).toMatchObject({ tipo: "abono", monto: null, medio: "efectivo", dudas: [], falta: [] });
    expect(t.cliente).toEqual({ dicho: null, elegido: rosa, opciones: [] });
    // Lo único que falta para confirmar es el monto.
    expect(faltaAbono(borradorAbono(t))).toEqual(["monto"]);
  });

  it("desde el cuaderno pide elegir al cliente y ofrece a los que más deben", () => {
    const sugeridos = [{ id: 1, nombre: "Luis Paredes" }];
    const t = tarjetaAbonoAMano(null, sugeridos);
    expect(t.cliente).toEqual({ dicho: null, elegido: null, opciones: sugeridos });
    expect(t.falta).toEqual(["cliente"]);
    expect(faltaAbono(borradorAbono(t))).toEqual(["cliente", "monto"]);
  });

  it("con el cliente y el monto elegidos ya se puede confirmar, y cuenta como corregido porque nada vino de la voz", () => {
    const t = tarjetaAbonoAMano(rosa);
    const borrador = { ...borradorAbono(t), monto: 40 };
    expect(faltaAbono(borrador)).toEqual([]);
    expect(fueCorregidoAbono(t, borrador)).toBe(true);
  });
});

describe("sinSesionAMano", () => {
  it("no promete que lo escrito espera en «Hoy»: a mano no queda nada esperando (/chaos 2026-11-05)", () => {
    const frase = sinSesionAMano("el abono");
    expect(frase).toBe("Tu sesión terminó. Vuelve a entrar y registra el abono otra vez.");
    expect(frase).not.toContain("Hoy");
  });
});

describe("sugeridosParaAbono", () => {
  const clientes = [
    { id: 1, nombre: "Luis Paredes", saldo: 2030 },
    { id: 2, nombre: "Rosa Quispe", saldo: 175 },
    { id: 3, nombre: "Juguería El Paraíso", saldo: 0 },
    { id: 4, nombre: "Bodega Santa Ana", saldo: 1702 },
    { id: 5, nombre: "Carlos Mendoza", saldo: -30 },
  ];

  it("ofrece solo a quienes deben, de mayor a menor deuda", () => {
    expect(sugeridosParaAbono(clientes).map((c) => c.id)).toEqual([1, 4, 2]);
  });

  it("no ofrece al que está al día ni al que tiene a favor", () => {
    const ids = sugeridosParaAbono(clientes).map((c) => c.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(5);
  });

  it("corta en la cantidad pedida y no cambia la lista original", () => {
    const copia = [...clientes];
    expect(sugeridosParaAbono(clientes, 2).map((c) => c.id)).toEqual([1, 4]);
    expect(clientes).toEqual(copia);
  });

  it("sin deudores no ofrece a nadie", () => {
    expect(sugeridosParaAbono([{ id: 3, nombre: "Al día", saldo: 0 }])).toEqual([]);
  });
});

describe("tarjetaMermaAMano", () => {
  const mango = { id: 1, nombre: "Mango Kent" };

  it("desde la fila de una fruta trae la fruta elegida y sin cajas: falta decir cuántas", () => {
    const t = tarjetaMermaAMano(mango);
    expect(t).toMatchObject({ tipo: "merma", cantidad: 0, motivo: null, falta: [] });
    expect(t.producto).toEqual({ dicho: null, elegido: mango, opciones: [] });
    expect(faltaMerma(borradorMerma(t))).toEqual(["cantidad"]);
  });

  it("desde Stock pide elegir la fruta y ofrece primero las que más se gastan", () => {
    const sugeridos = [{ id: 5, nombre: "Papaya" }];
    const t = tarjetaMermaAMano(null, sugeridos);
    expect(t.producto).toEqual({ dicho: null, elegido: null, opciones: sugeridos });
    expect(t.falta).toEqual(["producto"]);
    expect(faltaMerma(borradorMerma(t))).toEqual(["producto", "cantidad"]);
  });

  it("con fruta y cajas se puede guardar: la merma resta, sin motivo inventado, y cuenta como corregida", () => {
    const t = tarjetaMermaAMano(mango);
    const borrador = { ...borradorMerma(t), cantidad: 3 };
    expect(faltaMerma(borrador)).toEqual([]);
    expect(pedidoMerma(borrador, 77)).toEqual({ producto_id: 1, tipo: "merma", cantidad: -3, motivo: null, comando_voz_id: 77 });
    expect(fueCorregidaMerma(t, borrador)).toBe(true);
  });

  it("cero cajas, o más de dos decimales, no se guardan", () => {
    const t = tarjetaMermaAMano(mango);
    expect(pedidoMerma({ ...borradorMerma(t), cantidad: 0 }, 1)).toBeNull();
    expect(pedidoMerma({ ...borradorMerma(t), cantidad: 1.234 }, 1)).toBeNull();
  });
});

describe("sugeridosParaMerma", () => {
  const frutas = [
    { id: 1, nombre: "Mango Kent", stock: 20, desgaste: 0.2 },
    { id: 2, nombre: "Papaya", stock: 8, desgaste: 0.9 },
    { id: 3, nombre: "Piña golden", stock: 0, desgaste: 1 },
    { id: 4, nombre: "Uva", stock: 12, desgaste: 0.6 },
  ];

  it("ofrece primero la fruta más gastada y solo si hay stock", () => {
    expect(sugeridosParaMerma(frutas).map((f) => f.id)).toEqual([2, 4, 1]);
  });

  it("corta en la cantidad pedida y no cambia la lista original", () => {
    const copia = [...frutas];
    expect(sugeridosParaMerma(frutas, 2).map((f) => f.id)).toEqual([2, 4]);
    expect(frutas).toEqual(copia);
  });
});
