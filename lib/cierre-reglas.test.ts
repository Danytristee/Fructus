import { describe, expect, it } from "vitest";

import { calcularCierre, enlaceWhatsAppDelCierre, hayMovimientoEnElCierre, mensajeDelCierre } from "./cierre-reglas";

describe("calcularCierre", () => {
  const cierre = calcularCierre({
    ventasContado: [
      { monto: 520, medio: "efectivo" },
      { monto: 1008, medio: "yape" },
      { monto: 1236, medio: "transferencia" },
    ],
    ventasCredito: [1290, 1452],
    abonos: [
      { monto: 500, medio: "yape" },
      { monto: 600, medio: "efectivo" },
    ],
    gastos: [
      { monto: 120, medio: "efectivo" },
      { monto: 60, medio: "efectivo" },
    ],
    compras: [{ monto: 300, medio: "efectivo" }],
  });

  it("lo vendido es contado más crédito", () => {
    expect(cierre).toMatchObject({ vendido: 5506, contado: 2764, credito: 2742, abonos: 1100 });
  });

  it("el efectivo esperado en caja es lo que entró en efectivo menos lo que salió en efectivo", () => {
    // 520 + 600 − 120 − 60 − 300
    expect(cierre.efectivoEsperado).toBe(640);
  });

  it("lo digital (Yape, transferencia) se separa: no está en la caja", () => {
    expect(cierre.digital).toBe(2744);
    expect(cierre.porMedio.map((m) => m.medio)).toEqual(["efectivo", "yape", "transferencia"]);
  });

  it("un día sin movimientos cierra en cero", () => {
    expect(calcularCierre({ ventasContado: [], ventasCredito: [], abonos: [], gastos: [], compras: [] })).toMatchObject({
      vendido: 0,
      efectivoEsperado: 0,
      porMedio: [],
    });
  });
});

describe("el cierre por WhatsApp", () => {
  const cierre = calcularCierre({
    ventasContado: [
      { monto: 800, medio: "efectivo" },
      { monto: 120, medio: "yape" },
    ],
    ventasCredito: [330],
    abonos: [{ monto: 230, medio: "efectivo" }],
    gastos: [{ monto: 60, medio: "efectivo" }],
    compras: [{ monto: 400, medio: "efectivo" }],
  });
  // Lunes 9 de noviembre de 2026, 7 p. m. en Lima.
  const lunes = new Date("2026-11-10T00:00:00Z");

  it("lleva cada cifra de la pantalla, en soles y con la fecha de Lima", () => {
    expect(mensajeDelCierre(cierre, lunes)).toBe(
      [
        "*Cierre del día · lunes 9 de noviembre*",
        "Vendido: S/ 1,250.00",
        "• Al contado: S/ 920.00",
        "• Al crédito: S/ 330.00",
        "Abonos cobrados: S/ 230.00",
        "Gastos: S/ 60.00",
        "Compras al contado: S/ 400.00",
        "Efectivo que debe haber en la caja: S/ 570.00",
        "Por Yape, Plin o transferencia: S/ 120.00",
      ].join("\n"),
    );
  });

  it("sin nada por Yape, Plin o transferencia, esa línea no sale", () => {
    const soloEfectivo = calcularCierre({ ventasContado: [{ monto: 100, medio: "efectivo" }], ventasCredito: [], abonos: [], gastos: [], compras: [] });
    expect(mensajeDelCierre(soloEfectivo, lunes)).not.toMatch(/Yape/);
  });

  it("el enlace abre WhatsApp sin destinatario (la persona elige a quién) y el texto viaja codificado", () => {
    const enlace = enlaceWhatsAppDelCierre(cierre, lunes);
    expect(enlace.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(enlace.slice("https://wa.me/?text=".length))).toBe(mensajeDelCierre(cierre, lunes));
    expect(enlace).not.toMatch(/\s/); // ni un espacio ni un salto de línea sin codificar
  });

  it("el espacio duro de «S/ » no llega a WhatsApp: un espacio de verdad", () => {
    expect(mensajeDelCierre(cierre, lunes)).not.toContain("\u00a0");
  });

  it("un día en cero no tiene nada que mandar", () => {
    expect(hayMovimientoEnElCierre(calcularCierre({ ventasContado: [], ventasCredito: [], abonos: [], gastos: [], compras: [] }))).toBe(false);
    expect(hayMovimientoEnElCierre(cierre)).toBe(true);
    // Solo un gasto ya es un día con movimiento.
    expect(hayMovimientoEnElCierre(calcularCierre({ ventasContado: [], ventasCredito: [], abonos: [], gastos: [{ monto: 20, medio: null }], compras: [] }))).toBe(true);
  });
});
