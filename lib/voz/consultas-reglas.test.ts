import { describe, expect, it } from "vitest";

import { formatearSoles } from "../formato";
import { respuestaDeudaCliente, respuestaQuienMeDebe, respuestaStockProducto } from "./consultas-reglas";

const deudores = [
  { id: 2, nombre: "Rosa Quispe", saldo: 100 },
  { id: 1, nombre: "Luis Paredes", saldo: 680 },
  { id: 4, nombre: "Bodega Santa Ana", saldo: 352 },
  { id: 5, nombre: "Carlos Mendoza", saldo: 160 },
  { id: 3, nombre: "Juguería El Paraíso", saldo: 140 },
  { id: 6, nombre: "Restaurante Mochica", saldo: 40.5 },
];

describe("respuestaQuienMeDebe", () => {
  it("un veredicto: cuánto te deben y entre cuántos, y los que más deben primero", () => {
    const r = respuestaQuienMeDebe(deudores);
    expect(r).toMatchObject({
      titulo: "Quién te debe",
      etiqueta: "Te deben",
      cifra: { tipo: "soles", valor: 1472.5, tono: "deuda" },
      detalle: "entre 6 clientes",
      mas: 1,
      enlace: { texto: "Ver todo el cuaderno", href: "/clientes" },
    });
    expect(r.filas.map((f) => f.nombre)).toEqual(["Luis Paredes", "Bodega Santa Ana", "Carlos Mendoza", "Juguería El Paraíso", "Rosa Quispe"]);
    expect(r.filas[0]).toEqual({ id: 1, nombre: "Luis Paredes", valor: formatearSoles(680), tono: "deuda" });
  });

  it("lo hablado dice los montos como se dicen y nombra al que más debe", () => {
    expect(respuestaQuienMeDebe(deudores).hablado).toBe(
      "Te deben mil cuatrocientos setenta y dos soles con cincuenta céntimos, entre seis clientes. El que más te debe es Luis Paredes, con seiscientos ochenta soles.",
    );
  });

  it("con un solo deudor no dice «entre uno»", () => {
    const r = respuestaQuienMeDebe([{ id: 1, nombre: "Luis Paredes", saldo: 21 }]);
    expect(r.detalle).toBe("solo Luis Paredes");
    expect(r.hablado).toBe("Solo te debe Luis Paredes: veintiún soles.");
  });

  it("los saldos en cero o a favor no son deudas", () => {
    const r = respuestaQuienMeDebe([
      { id: 1, nombre: "Luis Paredes", saldo: 0 },
      { id: 2, nombre: "Rosa Quispe", saldo: -70 },
    ]);
    expect(r).toMatchObject({ etiqueta: "Nadie te debe", cifra: null, filas: [], mas: 0, hablado: "Nadie te debe. Tu cuaderno está al día." });
  });
});

describe("respuestaDeudaCliente", () => {
  it("cuánto te debe, en grande y dicho", () => {
    expect(respuestaDeudaCliente({ id: 1, nombre: "Luis Paredes", saldo: 1580 })).toMatchObject({
      titulo: "Cuánto te debe",
      etiqueta: "Luis Paredes te debe",
      cifra: { tipo: "soles", valor: 1580, tono: "deuda" },
      hablado: "Luis Paredes te debe mil quinientos ochenta soles.",
      enlace: { texto: "Ver el cuaderno", href: "/clientes" },
    });
  });

  it("al día o con saldo a favor, lo dice sin cifra de deuda", () => {
    expect(respuestaDeudaCliente({ id: 2, nombre: "Rosa Quispe", saldo: 0 })).toMatchObject({ etiqueta: "Rosa Quispe no te debe nada", cifra: null, hablado: "Rosa Quispe no te debe nada." });
    expect(respuestaDeudaCliente({ id: 2, nombre: "Rosa Quispe", saldo: -70 })).toMatchObject({
      etiqueta: "Rosa Quispe tiene a favor",
      cifra: { tipo: "soles", valor: 70, tono: "exito" },
      hablado: "Rosa Quispe no te debe. Tiene setenta soles a favor.",
    });
  });
});

describe("respuestaStockProducto", () => {
  it("cuántas cajas quedan, dichas en palabras", () => {
    expect(respuestaStockProducto({ id: 1, nombre: "Mango Kent", stock: 12 })).toMatchObject({
      titulo: "Cuánto te queda",
      etiqueta: "De Mango Kent te quedan",
      cifra: { tipo: "cajas", valor: 12 },
      hablado: "Te quedan doce cajas de Mango Kent.",
      enlace: { texto: "Ver todo el stock", href: "/stock" },
    });
    expect(respuestaStockProducto({ id: 1, nombre: "Mango Kent", stock: 1 }).hablado).toBe("Te queda una caja de Mango Kent.");
  });

  it("sin stock, o en negativo, dice que no queda y no muestra una cifra imposible", () => {
    expect(respuestaStockProducto({ id: 7, nombre: "Mandarina", stock: 0 })).toMatchObject({ etiqueta: "No te queda Mandarina", cifra: null, hablado: "No te queda Mandarina." });
    expect(respuestaStockProducto({ id: 1, nombre: "Mango Kent", stock: -4 })).toMatchObject({
      etiqueta: "No te queda Mango Kent",
      cifra: null,
      detalle: "Según la app faltan 4 cajas: revisa el stock.",
    });
  });
});
