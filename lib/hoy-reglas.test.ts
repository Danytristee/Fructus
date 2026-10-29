import { describe, expect, it } from "vitest";

import { acumulado, curvaDelDia, horaPico, inicioDelDiaLima, leerResumen, textoVentas, ventasPorHora } from "./hoy-reglas";

const resumen = {
  fecha: "2026-10-28",
  ventas_total: 2257,
  ventas_contado: 1155,
  ventas_credito: 1102,
  numero_ventas: 9,
  cajas_vendidas: 58,
  abonos: 200,
  compras: 3360,
  gastos: 40,
  por_cobrar_total: 1432,
};

describe("leerResumen", () => {
  it("cobrado es lo del contado más los abonos; lo del crédito no entró a la caja", () => {
    expect(leerResumen(resumen)).toEqual({ vendido: 2257, contado: 1155, credito: 1102, cobrado: 1355, porCobrar: 1432, numeroVentas: 9, cajas: 58 });
  });

  it("lo vendido es contado más crédito", () => {
    const dia = leerResumen(resumen);
    expect(dia.contado + dia.credito).toBe(dia.vendido);
  });

  it("acepta montos que llegan como texto (numeric de Postgres)", () => {
    expect(leerResumen({ ...resumen, ventas_total: "2257.00" }).vendido).toBe(2257);
  });

  it("si falta una llave, falla en vez de mostrar un cero inventado", () => {
    const incompleto: Record<string, unknown> = { ...resumen };
    delete incompleto.cajas_vendidas;
    expect(() => leerResumen(incompleto)).toThrow();
  });
});

describe("textoVentas", () => {
  it("usa singular y plural", () => {
    expect(textoVentas(9, 58)).toBe("58 cajas en 9 ventas");
    expect(textoVentas(1, 1)).toBe("1 caja en 1 venta");
  });
});

describe("inicioDelDiaLima", () => {
  it("a las 11 p. m. de Lima (4 a. m. UTC del día siguiente) el día sigue siendo el de Lima", () => {
    expect(inicioDelDiaLima(new Date("2026-10-29T04:00:00Z"))).toBe("2026-10-28T00:00:00-05:00");
  });
});

describe("ventasPorHora", () => {
  const ahora = new Date("2026-10-28T15:30:00Z"); // 10:30 a. m. en Lima

  it("suma por hora desde las 6 a. m. hasta ahora, con ceros en las horas flojas", () => {
    const horas = ventasPorHora(
      [
        { fecha: "2026-10-28T12:10:00Z", total: 100 }, // 7 a. m.
        { fecha: "2026-10-28T12:50:00Z", total: 50 }, // 7 a. m.
        { fecha: "2026-10-28T14:05:00Z", total: 300 }, // 9 a. m.
      ],
      ahora,
    );
    expect(horas).toEqual([
      { hora: 6, total: 0 },
      { hora: 7, total: 150 },
      { hora: 8, total: 0 },
      { hora: 9, total: 300 },
      { hora: 10, total: 0 },
    ]);
  });

  it("si vendió antes de las 6, empieza desde esa hora", () => {
    expect(ventasPorHora([{ fecha: "2026-10-28T09:30:00Z", total: 80 }], ahora)[0]).toEqual({ hora: 4, total: 80 });
  });

  it("sin ventas no hay horas", () => {
    expect(ventasPorHora([], ahora)).toEqual([]);
  });
});

describe("horaPico", () => {
  it("es la hora que más vendió", () => {
    expect(horaPico([{ hora: 6, total: 10 }, { hora: 9, total: 300 }, { hora: 10, total: 40 }])).toBe(9);
  });
});

describe("acumulado", () => {
  it("suma hora tras hora: el último punto es lo vendido en el día", () => {
    expect(acumulado([{ hora: 6, total: 0 }, { hora: 7, total: 150 }, { hora: 8, total: 0 }, { hora: 9, total: 300 }])).toEqual([
      { hora: 6, total: 0 },
      { hora: 7, total: 150 },
      { hora: 8, total: 150 },
      { hora: 9, total: 450 },
    ]);
  });
});

describe("curvaDelDia", () => {
  it("con menos de dos horas no hay curva", () => {
    expect(curvaDelDia([{ hora: 6, total: 100 }])).toBeNull();
  });

  it("empieza en el margen izquierdo, termina en el derecho y el pico queda arriba", () => {
    const curva = curvaDelDia([{ hora: 6, total: 0 }, { hora: 7, total: 300 }, { hora: 8, total: 100 }]);
    expect(curva?.linea.startsWith("M8,88")).toBe(true);
    expect(curva?.fin.x).toBe(312);
    expect(curva?.linea).toContain(" 160,14"); // el pico, arriba del todo (margen + 6)
    expect(curva?.area.endsWith("L312,96 L8,96 Z")).toBe(true);
  });

  it("con lo acumulado nunca baja ni se pasa del total: no dibuja ventas que no hubo", () => {
    const curva = curvaDelDia(acumulado([{ hora: 6, total: 0 }, { hora: 7, total: 150 }, { hora: 8, total: 0 }, { hora: 9, total: 300 }]));
    const ys = [...curva!.linea.matchAll(/,(-?[\d.]+)/g)].map((c) => Number(c[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(14); // nunca más arriba que el total
    expect(Math.max(...ys)).toBeLessThanOrEqual(88); // nunca más abajo que cero
  });
});
