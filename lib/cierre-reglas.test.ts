import { describe, expect, it } from "vitest";

import { calcularCierre } from "./cierre-reglas";

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
