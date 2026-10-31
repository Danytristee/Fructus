import { describe, expect, it } from "vitest";

import { formatearCajas, formatearSoles } from "../formato";
import { textoVentas, type ResumenHoy } from "../hoy-reglas";
import { respuestaDeudaCliente, respuestaGastosHoy, respuestaQuienMeDebe, respuestaResumenDia, respuestaStock, respuestaStockProducto, respuestaVentasHoy } from "./consultas-reglas";

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
      enlace: { texto: "Ver a los 6 en Clientes", href: "/clientes" },
    });
    expect(r.filas.map((f) => f.nombre)).toEqual(["Luis Paredes", "Bodega Santa Ana", "Carlos Mendoza", "Juguería El Paraíso", "Rosa Quispe"]);
    expect(r.filas[0]).toEqual({ id: 1, nombre: "Luis Paredes", valor: formatearSoles(680), tono: "deuda", icono: "cliente" });
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
    expect(r).toMatchObject({ etiqueta: "Nadie te debe", cifra: null, filas: [], hablado: "Nadie te debe. Tu cuaderno está al día." });
  });
});

describe("respuestaDeudaCliente", () => {
  it("cuánto te debe, en grande y dicho", () => {
    expect(respuestaDeudaCliente({ id: 1, nombre: "Luis Paredes", saldo: 1580 })).toMatchObject({
      titulo: "Cuánto te debe",
      etiqueta: "Luis Paredes te debe",
      cifra: { tipo: "soles", valor: 1580, tono: "deuda" },
      hablado: "Luis Paredes te debe mil quinientos ochenta soles.",
      enlace: { texto: "Ver en Clientes", href: "/clientes" },
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

const dia: ResumenHoy = { vendido: 2257, contado: 1155, credito: 1102, cobrado: 1355, abonos: 200, porCobrar: 1432, numeroVentas: 9, cajas: 58, compras: 3360, gastos: 40 };
const vacio: ResumenHoy = { vendido: 0, contado: 0, credito: 0, cobrado: 0, abonos: 0, porCobrar: 0, numeroVentas: 0, cajas: 0, compras: 0, gastos: 0 };

describe("respuestaVentasHoy", () => {
  it("lo vendido, partido en contado y crédito, igual que «Hoy»", () => {
    expect(respuestaVentasHoy(dia)).toMatchObject({
      titulo: "Lo que vendiste hoy",
      etiqueta: "Hoy vendiste",
      cifra: { tipo: "soles", valor: 2257, tono: "normal" },
      detalle: textoVentas(9, 58),
      hablado: "Hoy vendiste dos mil doscientos cincuenta y siete soles, en nueve ventas: mil ciento cincuenta y cinco al contado y mil ciento dos al crédito.",
    });
    expect(respuestaVentasHoy(dia).filas.map((f) => [f.nombre, f.valor, f.icono])).toEqual([
      ["Al contado", formatearSoles(1155), "ninguno"],
      ["Al crédito", formatearSoles(1102), "ninguno"],
    ]);
  });

  it("sin ventas, lo dice", () => {
    expect(respuestaVentasHoy(vacio)).toMatchObject({ etiqueta: "Hoy todavía no vendes", cifra: null, filas: [], hablado: "Hoy todavía no vendes nada." });
  });
});

describe("respuestaGastosHoy", () => {
  it("los gastos, y aparte lo que pagaste en fruta", () => {
    expect(respuestaGastosHoy(dia)).toMatchObject({
      titulo: "Lo que gastaste hoy",
      etiqueta: "Hoy gastaste",
      cifra: { tipo: "soles", valor: 40, tono: "normal" },
      detalle: `Y en compras de fruta, ${formatearSoles(3360)}`,
      hablado: "Hoy gastaste cuarenta soles. En compras de fruta, tres mil trescientos sesenta soles.",
    });
  });

  it("sin gastos ni compras, lo dice", () => {
    expect(respuestaGastosHoy(vacio)).toMatchObject({ etiqueta: "Hoy no tienes gastos", cifra: null, detalle: null, hablado: "Hoy no tienes gastos." });
  });
});

describe("respuestaResumenDia", () => {
  it("solo lo de hoy: vendido en grande; cobrado, fiado, gastado y comprado aparte (/formidable 2026-10-31)", () => {
    const r = respuestaResumenDia(dia);
    expect(r).toMatchObject({ titulo: "Tu día", etiqueta: "Hoy vendiste", cifra: { tipo: "soles", valor: 2257, tono: "normal" }, detalle: textoVentas(9, 58) });
    expect(r.filas.map((f) => [f.nombre, f.valor])).toEqual([
      ["Cobraste al contado", formatearSoles(1155)],
      ["Te abonaron", formatearSoles(200)],
      ["Fiaste hoy", formatearSoles(1102)],
      ["Gastaste", formatearSoles(40)],
      ["Compraste fruta", formatearSoles(3360)],
    ]);
    expect(r.hablado).toBe(
      "Hoy vendiste dos mil doscientos cincuenta y siete soles y cobraste mil trescientos cincuenta y cinco, con los abonos. Fiaste mil ciento dos.",
    );
  });

  it("sin fiado, no lo dice", () => {
    expect(respuestaResumenDia({ ...dia, credito: 0 }).hablado).toBe("Hoy vendiste dos mil doscientos cincuenta y siete soles y cobraste mil trescientos cincuenta y cinco, con los abonos.");
  });
});

describe("respuestaStock", () => {
  const productos = [
    { id: 1, nombre: "Mango Kent", stock: 15 },
    { id: 3, nombre: "Plátano de seda", stock: 34 },
    { id: 7, nombre: "Mandarina", stock: 0 },
    { id: 8, nombre: "Uva red globe", stock: -2 },
    { id: 5, nombre: "Papaya", stock: 10.5 },
  ];

  it("cuántas cajas hay y de qué, la que más primero; lo que no hay no se cuenta", () => {
    const r = respuestaStock(productos);
    expect(r).toMatchObject({ titulo: "Tu stock", etiqueta: "Tienes", cifra: { tipo: "cajas", valor: 59.5 }, detalle: "de 3 frutas" });
    expect(r.filas.map((f) => [f.nombre, f.valor, f.icono])).toEqual([
      ["Plátano de seda", formatearCajas(34), "fruta"],
      ["Mango Kent", formatearCajas(15), "fruta"],
      ["Papaya", formatearCajas(10.5), "fruta"],
    ]);
    expect(r.hablado).toBe("Tienes cincuenta y nueve cajas y media, de tres frutas. La que más tienes es Plátano de seda, con treinta y cuatro cajas.");
  });

  it("sin fruta, lo dice", () => {
    expect(respuestaStock([{ id: 7, nombre: "Mandarina", stock: 0 }])).toMatchObject({ etiqueta: "No te queda fruta", cifra: null, hablado: "No te queda fruta." });
  });
});
