import { describe, expect, it } from "vitest";

import { armarLibro, mesDeLima, mesesParaExportar, nombreDelArchivo, rangoDelMes, serialExcel, type Celda, type DatosDelMes, type Libro } from "./exportar-reglas";

const AHORA = new Date("2026-11-08T15:00:00Z"); // 10 a. m. del 8 de noviembre en Lima

describe("mesDeLima (el mes del puesto, no el de UTC)", () => {
  it("el 30 a las 10 p. m. sigue siendo ese mes aunque en UTC ya sea el 1 del siguiente", () => {
    expect(mesDeLima(new Date("2026-12-01T03:00:00Z"))).toBe("2026-11");
    expect(mesDeLima(new Date("2026-12-01T05:00:00Z"))).toBe("2026-12");
  });
});

describe("rangoDelMes", () => {
  it("un mes: desde el día 1 a medianoche de Lima hasta el día 1 del siguiente", () => {
    expect(rangoDelMes("2026-10", AHORA)).toEqual({
      mes: "2026-10",
      desde: "2026-10-01T00:00:00-05:00",
      hasta: "2026-11-01T00:00:00-05:00",
      etiqueta: "Octubre 2026",
    });
  });

  it("diciembre cierra en enero del año siguiente", () => {
    expect(rangoDelMes("2026-12", new Date("2026-12-15T15:00:00Z"))?.hasta).toBe("2027-01-01T00:00:00-05:00");
  });

  it("la venta del 31 a las 9 p. m. cae en octubre y la del 1 a las 12:01 a. m., en noviembre", () => {
    const r = rangoDelMes("2026-10", AHORA)!;
    const dentro = (instante: string) => Date.parse(instante) >= Date.parse(r.desde) && Date.parse(instante) < Date.parse(r.hasta);
    expect(dentro("2026-11-01T02:00:00Z")).toBe(true); // 31-oct 9:00 p. m. en Lima
    expect(dentro("2026-11-01T05:01:00Z")).toBe(false); // 1-nov 12:01 a. m. en Lima
  });

  it("el mes en curso se puede exportar", () => {
    expect(rangoDelMes("2026-11", AHORA)?.etiqueta).toBe("Noviembre 2026");
  });

  it.each(["2026-13", "2026-00", "2026-1", "26-10", "octubre", "", "2026-10-01", "1999-12", "0000-01"])("rechaza «%s»", (mes) => {
    expect(rangoDelMes(mes, AHORA)).toBeNull();
  });

  it("rechaza un mes que todavía no llega: no hay nada que exportar", () => {
    expect(rangoDelMes("2026-12", AHORA)).toBeNull();
    expect(rangoDelMes("2027-01", AHORA)).toBeNull();
  });
});

describe("mesesParaExportar", () => {
  it("del mes en curso hacia atrás, cruzando el año", () => {
    expect(mesesParaExportar(new Date("2026-02-10T12:00:00Z"), 4)).toEqual([
      { mes: "2026-02", etiqueta: "Febrero 2026", enCurso: true },
      { mes: "2026-01", etiqueta: "Enero 2026", enCurso: false },
      { mes: "2025-12", etiqueta: "Diciembre 2025", enCurso: false },
      { mes: "2025-11", etiqueta: "Noviembre 2025", enCurso: false },
    ]);
  });

  it("todos los que ofrece son meses que rangoDelMes acepta", () => {
    for (const m of mesesParaExportar(AHORA, 12)) expect(rangoDelMes(m.mes, AHORA)).not.toBeNull();
  });
});

describe("nombreDelArchivo", () => {
  it("lleva el mes, para que el contador no mezcle archivos", () => {
    expect(nombreDelArchivo("2026-10")).toBe("fructus-2026-10.xlsx");
  });
});

describe("serialExcel (la fecha como número de Excel, con la hora de Lima)", () => {
  it("medianoche de Lima es un día entero", () => {
    expect(serialExcel("2026-11-09T05:00:00Z")).toBeCloseTo(46335, 6);
    expect(serialExcel("1970-01-01T05:00:00Z")).toBeCloseTo(25569, 6);
  });

  it("las 10 p. m. de Lima son 22/24 del día, aunque en UTC ya sea el día siguiente; acepta los microsegundos de Postgres", () => {
    expect(serialExcel("2026-11-09T03:00:00.123456+00:00")).toBeCloseTo(46334 + 22 / 24, 5);
  });
});

// -----------------------------------------------------------------------------------------------------------------------------------
// El libro
// -----------------------------------------------------------------------------------------------------------------------------------

const rango = rangoDelMes("2026-10", AHORA)!;
const f = (dia: number, hora = 14) => `2026-10-${String(dia).padStart(2, "0")}T${String(hora).padStart(2, "0")}:00:00+00:00`;

const mes: DatosDelMes = {
  rango,
  clientes: [
    { id: 1, nombre: "Don Lucho" },
    { id: 2, nombre: "Doña Rosa" },
  ],
  productos: [{ id: 1, nombre: "Mango", variedad: "Kent" }],
  proveedores: [{ id: 1, nombre: "Agrícola Chicama" }],
  ventas: [
    // Fuera de orden a propósito: el archivo sale del más viejo al más nuevo.
    { id: 1, fecha: f(3), total: 500, condicion: "contado", medio_pago: "efectivo", estado: "registrada", motivo_anulacion: null, cliente_id: 1, comprobantes: [{ id: 1, tipo: "03", serie: "B001", numero: 12, estado: "aceptado" }] },
    { id: 2, fecha: f(2), total: 230.5, condicion: "credito", medio_pago: null, estado: "registrada", motivo_anulacion: null, cliente_id: 2, comprobantes: [] },
    { id: 3, fecha: f(4), total: 100, condicion: "contado", medio_pago: "yape", estado: "anulada", motivo_anulacion: "Se equivocó de cliente", cliente_id: null, comprobantes: [] },
  ],
  items: [
    { id: 1, venta_id: 1, producto_id: 1, cantidad: 10, precio_unitario: 50, descuento: 0, subtotal: 500, venta: { fecha: f(3), estado: "registrada", cliente_id: 1 } },
    { id: 2, venta_id: 2, producto_id: 1, cantidad: 4.5, precio_unitario: 51.22, descuento: 0, subtotal: 230.5, venta: { fecha: f(2), estado: "registrada", cliente_id: 2 } },
    { id: 3, venta_id: 3, producto_id: 99, cantidad: 2, precio_unitario: 50, descuento: 0, subtotal: 100, venta: { fecha: f(4), estado: "anulada", cliente_id: null } },
  ],
  abonos: [{ id: 1, fecha: f(5), monto: 100, medio_pago: "yape", nota: null, cliente_id: 2 }],
  gastos: [{ id: 1, fecha: f(6), monto: 40, medio_pago: "efectivo", categoria: "flete", descripcion: "Camión" }],
  compras: [
    { id: 1, fecha: f(7), total: 1000, condicion: "contado", medio_pago: "efectivo", numero_comprobante: "F001-55", proveedor_id: 1 },
    { id: 2, fecha: f(8), total: 800, condicion: "credito", medio_pago: null, numero_comprobante: null, proveedor_id: 1 },
  ],
  mermas: [{ id: 1, fecha: f(9), cantidad: -3, motivo: "Se malogró", producto_id: 1 }],
};

const hoja = (libro: Libro, nombre: string) => libro.find((h) => h.nombre === nombre)!;
/** El valor de una fila del resumen, buscada por su título. */
const delResumen = (libro: Libro, titulo: string): Celda | undefined => hoja(libro, "Resumen").filas.find((fila) => fila[0] === titulo)?.[1];
const solesDe = (celda: Celda | undefined) => (celda && typeof celda === "object" ? celda.v : NaN);

describe("armarLibro", () => {
  const libro = armarLibro(mes, new Date("2026-11-08T15:00:00Z"));

  it("trae las siete hojas, en el orden en que las lee un contador", () => {
    expect(libro.map((h) => h.nombre)).toEqual(["Resumen", "Ventas", "Detalle de ventas", "Abonos", "Compras", "Gastos", "Mermas"]);
  });

  it("el resumen no suma lo anulado ni la compra al crédito", () => {
    expect(solesDe(delResumen(libro, "Vendido en total"))).toBe(730.5);
    expect(solesDe(delResumen(libro, "   al contado"))).toBe(500);
    expect(solesDe(delResumen(libro, "   al crédito"))).toBe(230.5);
    expect(solesDe(delResumen(libro, "Abonos cobrados"))).toBe(100);
    expect(solesDe(delResumen(libro, "Gastos"))).toBe(40);
    expect(solesDe(delResumen(libro, "Compras al contado"))).toBe(1000);
    expect(solesDe(delResumen(libro, "Ventas registradas"))).toBe(2);
    expect(solesDe(delResumen(libro, "Ventas anuladas (no cuentan)"))).toBe(1);
    expect(solesDe(delResumen(libro, "Cajas malogradas (mermas)"))).toBe(3);
  });

  it("cómo entró y salió la plata: la venta anulada por Yape no está, el abono por Yape sí", () => {
    const filas = hoja(libro, "Resumen").filas;
    const efectivo = filas.find((x) => x[0] === "Efectivo")!;
    const yape = filas.find((x) => x[0] === "Yape")!;
    expect(efectivo.slice(1).map(solesDe)).toEqual([500, 1040, -540]);
    expect(yape.slice(1).map(solesDe)).toEqual([100, 0, 100]);
  });

  it("el resumen coincide con la suma de la hoja de ventas registradas (lo que ve el contador cuadra)", () => {
    const { filas } = hoja(libro, "Ventas");
    const titulos = filas[0]!;
    const total = titulos.indexOf("Total");
    const estado = titulos.indexOf("Estado");
    const suma = filas
      .slice(1)
      .filter((fila) => fila[estado] === "Registrada")
      .reduce((s, fila) => s + solesDe(fila[total]), 0);
    expect(suma).toBe(solesDe(delResumen(libro, "Vendido en total")));
  });

  it("las ventas salen de la más vieja a la más nueva, con el cliente por su nombre y la anulada marcada con su motivo", () => {
    const { filas } = hoja(libro, "Ventas");
    expect(filas[0]).toEqual(["Fecha", "N.º de venta", "Cliente", "Condición", "Medio de pago", "Total", "Estado", "Comprobante", "Estado del comprobante", "Motivo de anulación"]);
    expect(filas.slice(1).map((x) => solesDe(x[1]))).toEqual([2, 1, 3]);
    expect(filas[1]!.slice(2, 5)).toEqual(["Doña Rosa", "Crédito", null]); // al crédito: no hay medio de pago
    expect(filas[2]!.slice(2, 5)).toEqual(["Don Lucho", "Contado", "Efectivo"]);
    expect(filas[3]!.slice(2, 5)).toEqual(["Sin cliente", "Contado", "Yape"]);
    expect(filas[3]!.slice(6)).toEqual(["Anulada", null, null, "Se equivocó de cliente"]);
  });

  it("el comprobante dice su tipo, serie y número con ceros, y en qué quedó", () => {
    const fila = hoja(libro, "Ventas").filas[2]!;
    expect(fila.slice(7, 9)).toEqual(["Boleta B001-00000012", "aceptada por SUNAT"]);
  });

  it("los montos y las fechas son números de Excel con su formato, nunca texto", () => {
    for (const h of libro) {
      for (const celda of h.filas.flat()) {
        if (typeof celda === "string") expect(celda, "un monto escrito como texto no se puede sumar").not.toMatch(/^S\/\s?[\d,.]+$/);
      }
    }
    const venta = hoja(libro, "Ventas").filas[2]!;
    expect(venta[0]).toEqual({ v: serialExcel(f(3)), f: "fecha-hora" });
    expect(venta[5]).toEqual({ v: 500, f: "soles" });
  });

  it("el detalle trae la fruta con su variedad, y avisa si la fruta ya no está", () => {
    const { filas } = hoja(libro, "Detalle de ventas");
    expect(filas.slice(1).map((x) => x[3])).toEqual(["Mango Kent", "Mango Kent", "Fruta que ya no está"]);
    expect(filas[2]!.slice(4, 8)).toEqual([{ v: 10, f: "numero" }, { v: 50, f: "soles" }, { v: 0, f: "soles" }, { v: 500, f: "soles" }]);
  });

  it("la merma sale en cajas positivas, aunque se guarda como salida (negativa)", () => {
    expect(hoja(libro, "Mermas").filas[1]!.slice(1)).toEqual(["Mango Kent", { v: 3, f: "numero" }, "Se malogró"]);
  });

  it("abonos, compras y gastos traen a quién, cómo y cuánto", () => {
    expect(hoja(libro, "Abonos").filas[1]!.slice(1)).toEqual(["Doña Rosa", { v: 100, f: "soles" }, "Yape", null]);
    expect(hoja(libro, "Compras").filas.slice(1).map((x) => x.slice(1, 5))).toEqual([
      ["Agrícola Chicama", "Contado", "Efectivo", "F001-55"],
      ["Agrícola Chicama", "Crédito", null, null],
    ]);
    expect(hoja(libro, "Gastos").filas[1]!.slice(1)).toEqual(["Flete", "Camión", { v: 40, f: "soles" }, "Efectivo"]);
  });

  it("las tablas llevan filtro desde sus títulos; el resumen, no", () => {
    expect(hoja(libro, "Resumen").encabezado).toBeUndefined();
    for (const h of libro.slice(1)) expect(h.encabezado, h.nombre).toBe(0);
  });

  it("un mes sin movimientos da el archivo con sus títulos y los totales en cero, no un error", () => {
    const vacio = armarLibro({ ...mes, ventas: [], items: [], abonos: [], gastos: [], compras: [], mermas: [] }, AHORA);
    expect(solesDe(delResumen(vacio, "Vendido en total"))).toBe(0);
    expect(solesDe(delResumen(vacio, "Ventas registradas"))).toBe(0);
    for (const h of vacio.slice(1)) expect(h.filas, h.nombre).toHaveLength(1);
  });

  it("un cliente que ya no está en el catálogo no rompe el archivo", () => {
    const l = armarLibro({ ...mes, clientes: [] }, AHORA);
    expect(hoja(l, "Ventas").filas[1]![2]).toBe("Cliente que ya no está");
  });
});
