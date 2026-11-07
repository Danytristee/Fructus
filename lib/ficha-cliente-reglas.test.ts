import { describe, expect, it } from "vitest";

import { enlaceDeLlamada, estadoDeuda, etiquetaDeDia, historialDelCliente, horaDeLima, parteDeLaDeuda } from "./ficha-cliente-reglas";
import type { AbonoLeido, VentaLeida } from "./operaciones-reglas";

const rosa = { id: 2, nombre: "Rosa Quispe" };
const mango = { nombre: "Mango", variedad: "Kent" };

const venta = (id: number, fecha: string, extra: Partial<VentaLeida> = {}): VentaLeida => ({
  id,
  fecha,
  total: 120,
  condicion: "credito",
  medio: null,
  cliente: rosa,
  items: [{ cantidad: 10, producto: mango }],
  ...extra,
});
const abono = (id: number, fecha: string, monto = 50): AbonoLeido => ({ id, fecha, monto, medio: "yape", cliente: rosa });

// 5 nov 2026, 10 a. m. en Lima (UTC−5).
const AHORA = new Date("2026-11-05T15:00:00Z");

describe("estadoDeuda", () => {
  it("dice lo que debe, que está al día o lo que tiene a favor", () => {
    expect(estadoDeuda(230)).toEqual({ tipo: "debe", monto: 230 });
    expect(estadoDeuda(0)).toEqual({ tipo: "al_dia" });
    expect(estadoDeuda(-70)).toEqual({ tipo: "a_favor", monto: 70 });
  });

  it("compara en céntimos: el ruido de los decimales no inventa deuda", () => {
    expect(estadoDeuda(0.1 + 0.2 - 0.3)).toEqual({ tipo: "al_dia" });
    expect(estadoDeuda(0.1 + 0.2)).toEqual({ tipo: "debe", monto: 0.3 });
  });
});

describe("parteDeLaDeuda", () => {
  it("es el porcentaje de todo lo que te deben, de 0 a 100", () => {
    expect(parteDeLaDeuda(230, 1000)).toBe(23);
    expect(parteDeLaDeuda(1000, 1000)).toBe(100);
  });

  it("no divide entre cero ni cuenta a quien no debe", () => {
    expect(parteDeLaDeuda(0, 1000)).toBe(0);
    expect(parteDeLaDeuda(-50, 1000)).toBe(0);
    expect(parteDeLaDeuda(100, 0)).toBe(0);
  });
});

describe("etiquetaDeDia y horaDeLima", () => {
  it("dice hoy, ayer o la fecha completa", () => {
    expect(etiquetaDeDia(new Date("2026-11-05T13:00:00Z"), AHORA)).toBe("hoy");
    expect(etiquetaDeDia(new Date("2026-11-04T13:00:00Z"), AHORA)).toBe("ayer");
    expect(etiquetaDeDia(new Date("2026-10-28T13:00:00Z"), AHORA)).toBe("miércoles 28 de octubre");
  });

  it("cuenta el día en Lima: 11 p. m. de ayer en Lima ya es 4 de la madrugada en UTC", () => {
    expect(etiquetaDeDia(new Date("2026-11-05T04:30:00Z"), AHORA)).toBe("ayer");
  });

  it("pone la hora de Lima con p. m. y a. m.", () => {
    expect(horaDeLima(new Date("2026-11-05T20:15:00Z")).replace(/\s/g, " ")).toBe("3:15 p. m.");
    expect(horaDeLima(new Date("2026-11-05T13:05:00Z")).replace(/\s/g, " ")).toBe("8:05 a. m.");
  });
});

describe("historialDelCliente", () => {
  it("mezcla ventas y abonos de lo más reciente a lo más viejo, agrupados por día de Lima", () => {
    const { dias, hayMas } = historialDelCliente(
      {
        ventas: [venta(1, "2026-11-03T15:00:00Z"), venta(2, "2026-11-05T14:00:00Z")],
        abonos: [abono(7, "2026-11-05T19:00:00Z"), abono(8, "2026-11-04T15:00:00Z")],
      },
      AHORA,
    );
    expect(hayMas).toBe(false);
    expect(dias.map((d) => d.etiqueta)).toEqual(["hoy", "ayer", "martes 3 de noviembre"]);
    expect(dias[0]!.operaciones.map((o) => o.clave)).toEqual(["abono-7", "venta-2"]);
  });

  it("una fila dice qué pasó y a qué hora, sin repetir el nombre ni la cara del cliente", () => {
    const { dias } = historialDelCliente({ ventas: [venta(1, "2026-11-05T20:15:00Z")], abonos: [abono(7, "2026-11-05T21:00:00Z")] }, AHORA);
    const [abonoFila, ventaFila] = dias[0]!.operaciones;
    expect(ventaFila).toMatchObject({ titulo: "10 de mango kent", estado: "debe", monto: 120, persona: null });
    expect(ventaFila!.detalle.replace(/\s/g, " ")).toBe("3:15 p. m.");
    expect(abonoFila).toMatchObject({ titulo: "Abonó con Yape", estado: "abono", monto: 50, persona: null });
  });

  it("una venta al contado dice cómo pagó", () => {
    const { dias } = historialDelCliente({ ventas: [venta(1, "2026-11-05T15:00:00Z", { condicion: "contado", medio: "efectivo" })], abonos: [] }, AHORA);
    expect(dias[0]!.operaciones[0]).toMatchObject({ titulo: "10 de mango kent, en efectivo", estado: "pago" });
  });

  it("corta en el tope y avisa que hay más", () => {
    const ventas = [venta(1, "2026-11-05T10:00:00Z"), venta(2, "2026-11-05T11:00:00Z"), venta(3, "2026-11-05T12:00:00Z")];
    const { dias, hayMas } = historialDelCliente({ ventas, abonos: [] }, AHORA, 2);
    expect(hayMas).toBe(true);
    expect(dias.flatMap((d) => d.operaciones).map((o) => o.clave)).toEqual(["venta-3", "venta-2"]);
  });

  it("sin movimientos no hay días ni «hay más»", () => {
    expect(historialDelCliente({ ventas: [], abonos: [] }, AHORA)).toEqual({ dias: [], hayMas: false });
  });
});

describe("enlaceDeLlamada", () => {
  it("arma el enlace con solo los dígitos", () => {
    expect(enlaceDeLlamada("987 654 321")).toBe("tel:987654321");
    expect(enlaceDeLlamada("+51 987-654-321")).toBe("tel:+51987654321");
    expect(enlaceDeLlamada("(044) 234567")).toBe("tel:044234567");
  });

  it("no inventa un enlace con lo que no es un teléfono", () => {
    expect(enlaceDeLlamada(null)).toBeNull();
    expect(enlaceDeLlamada("")).toBeNull();
    expect(enlaceDeLlamada("llamar a la tarde")).toBeNull();
    expect(enlaceDeLlamada("123")).toBeNull();
  });
});
