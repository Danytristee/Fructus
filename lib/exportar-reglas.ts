// Exportar el mes a Excel, para el contador: qué hojas lleva el archivo y qué dice cada columna. Lógica pura: no importa React, Supabase
// ni SheetJS (lib/exportar-xlsx.ts lo convierte en archivo y lib/exportar-mes.ts lee la base).
//
// El problema: el contador no entra a la app, recibe un archivo. Si las fechas o los montos llegan como texto, o las ventas anuladas
// vienen mezcladas en el total, tiene que arreglarlo a mano, y una cifra que no cuadra con la app le quita la confianza al archivo entero.
// Mal hecho: «Total» como "S/ 1,250.00" (texto: no se suma), una fecha en UTC (la venta de las 8 p. m. cae al día siguiente) o el
// total del mes sumando lo anulado.
// Bien hecho: montos y fechas como números de Excel (con su formato), horas de Lima, y el resumen sale de la misma cuenta que el cierre del día.

import { calcularCierre, type Medio } from "./cierre-reglas";
import { comprobanteAMostrar, fraseDeComprobante, type CodigoTipo } from "./comprobantes/comprobante-reglas";
import { diaDeLima } from "./formato";

// -----------------------------------------------------------------------------------------------------------------------------------
// El mes
// -----------------------------------------------------------------------------------------------------------------------------------

const LIMA_MS = 5 * 3_600_000; // Lima es UTC−5 todo el año: no tiene horario de verano.
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
const PRIMER_ANIO = 2000; // un año de 4 cifras como «0000» no existe en Postgres: se rechaza aquí, no con un error de la base

/** El mes de Lima (AAAA-MM) de un instante: el 30 a las 10 p. m. sigue siendo ese mes aunque en UTC ya sea el 1 del siguiente. */
export function mesDeLima(ahora: Date): string {
  return diaDeLima(ahora).slice(0, 7);
}

export type RangoDelMes = {
  mes: string;
  /** Desde (incluido) y hasta (excluido), con la hora de Lima: `fecha >= desde and fecha < hasta`. */
  desde: string;
  hasta: string;
  etiqueta: string;
};

/** El rango de un mes «AAAA-MM». Nulo si no es un mes de verdad o todavía no llega: no hay nada que exportar. */
export function rangoDelMes(mes: string, ahora: Date): RangoDelMes | null {
  const partes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
  if (!partes) return null;
  const anio = Number(partes[1]);
  const delAnio = Number(partes[2]);
  if (anio < PRIMER_ANIO || mes > mesDeLima(ahora)) return null;
  const siguiente = delAnio === 12 ? `${anio + 1}-01` : `${anio}-${String(delAnio + 1).padStart(2, "0")}`;
  return { mes, desde: `${mes}-01T00:00:00-05:00`, hasta: `${siguiente}-01T00:00:00-05:00`, etiqueta: `${MESES[delAnio - 1]} ${anio}` };
}

export type MesParaExportar = { mes: string; etiqueta: string; enCurso: boolean };

/** Los últimos meses, del actual hacia atrás: los que se ofrecen para descargar. */
export function mesesParaExportar(ahora: Date, cuantos = 6): MesParaExportar[] {
  const actual = mesDeLima(ahora);
  const inicio = Number(actual.slice(0, 4)) * 12 + Number(actual.slice(5, 7)) - 1; // meses contados desde el año 0
  return Array.from({ length: cuantos }, (_, i) => {
    const indice = inicio - i;
    const clave = `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
    return { mes: clave, etiqueta: `${MESES[indice % 12]} ${Math.floor(indice / 12)}`, enCurso: i === 0 };
  });
}

/** El nombre del archivo que se baja: fructus-2026-10.xlsx */
export const nombreDelArchivo = (mes: string) => `fructus-${mes}.xlsx`;

/**
 * La fecha como la guarda Excel: días desde 1900, con la hora de Lima. Se calcula a mano para no depender de la zona del servidor
 * (Vercel corre en UTC): si SheetJS convirtiera un `Date`, la venta de las 8 p. m. saldría con la hora corrida.
 */
export function serialExcel(instante: string): number {
  return (Date.parse(instante) - LIMA_MS) / 86_400_000 + 25_569;
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Lo que se lee de la base
// -----------------------------------------------------------------------------------------------------------------------------------

export type DatosDelMes = {
  rango: RangoDelMes;
  /** Los catálogos, completos: una venta del mes puede ser de un cliente o una fruta que hoy está inactivo. */
  clientes: { id: number; nombre: string }[];
  productos: { id: number; nombre: string; variedad: string | null }[];
  proveedores: { id: number; nombre: string }[];
  ventas: {
    id: number;
    fecha: string;
    total: number;
    condicion: "contado" | "credito";
    medio_pago: Medio | null;
    estado: string;
    motivo_anulacion: string | null;
    cliente_id: number | null;
    comprobantes: { id: number; tipo: string; serie: string; numero: number; estado: string }[];
  }[];
  /** Las líneas de las ventas del mes, con la venta de la que son (fecha, estado y cliente). */
  items: {
    id: number;
    venta_id: number;
    producto_id: number;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    subtotal: number | null;
    venta: { fecha: string; estado: string; cliente_id: number | null };
  }[];
  abonos: { id: number; fecha: string; monto: number; medio_pago: Medio; nota: string | null; cliente_id: number }[];
  gastos: { id: number; fecha: string; monto: number; medio_pago: Medio; categoria: string; descripcion: string | null }[];
  compras: {
    id: number;
    fecha: string;
    total: number;
    condicion: "contado" | "credito";
    medio_pago: Medio | null;
    numero_comprobante: string | null;
    proveedor_id: number | null;
  }[];
  /** Las salidas de stock por merma: la cantidad viene negativa, como se guarda. */
  mermas: { id: number; fecha: string; cantidad: number; motivo: string | null; producto_id: number }[];
};

// -----------------------------------------------------------------------------------------------------------------------------------
// El libro
// -----------------------------------------------------------------------------------------------------------------------------------

export type Formato = "soles" | "fecha-hora" | "numero";
/** Un texto, una celda vacía, o un número con el formato con que Excel lo muestra (sigue siendo un número: se puede sumar y filtrar). */
export type Celda = string | null | { v: number; f: Formato };
type Hoja = {
  nombre: string;
  /** Ancho de cada columna, en caracteres. */
  anchos: number[];
  filas: Celda[][];
  /** La fila (desde 0) con los títulos de la tabla: desde ahí se pone el filtro. Sin esto, la hoja no lleva filtro. */
  encabezado?: number;
};
export type Libro = Hoja[];

const soles = (n: number | null): Celda => (n === null ? null : { v: n, f: "soles" });
const numero = (n: number): Celda => ({ v: n, f: "numero" });
const fecha = (instante: string): Celda => ({ v: serialExcel(instante), f: "fecha-hora" });

const medios: Record<Medio, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", otro: "Otro" };
const condiciones = { contado: "Contado", credito: "Crédito" } as const;
const categorias: Record<string, string> = { flete: "Flete", alquiler: "Alquiler", servicios: "Servicios", personal: "Personal", otros: "Otros" };

const medio = (m: Medio | null): string | null => (m ? medios[m] : null);
const nombreDeFruta = (p: { nombre: string; variedad: string | null } | undefined) => (p ? [p.nombre, p.variedad].filter(Boolean).join(" ") : "Fruta que ya no está");
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Del más viejo al más nuevo; a igual hora, por orden de registro. */
const cronologico = <T extends { id: number; fecha: string }>(filas: T[]): T[] =>
  [...filas].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha) || a.id - b.id);

const porId = <T extends { id: number }>(filas: T[]) => new Map(filas.map((f) => [f.id, f]));

/**
 * Arma las hojas del mes. El resumen sale de calcularCierre, la misma cuenta del cierre del día, así que una cifra de aquí no puede
 * contradecir la de la app. Las ventas anuladas se ven en su hoja, marcadas, pero no entran en ningún total.
 */
export function armarLibro(d: DatosDelMes, generado: Date): Libro {
  const clientes = porId(d.clientes);
  const productos = porId(d.productos);
  const proveedores = porId(d.proveedores);
  const nombreDelCliente = (id: number | null) => (id === null ? "Sin cliente" : (clientes.get(id)?.nombre ?? "Cliente que ya no está"));

  const ventas = cronologico(d.ventas);
  const registradas = ventas.filter((v) => v.estado === "registrada");
  const anuladas = ventas.filter((v) => v.estado !== "registrada");
  const abonos = cronologico(d.abonos);
  const gastos = cronologico(d.gastos);
  const compras = cronologico(d.compras);
  const mermas = cronologico(d.mermas);

  const cierre = calcularCierre({
    ventasContado: registradas.filter((v) => v.condicion === "contado").map((v) => ({ monto: v.total, medio: v.medio_pago })),
    ventasCredito: registradas.filter((v) => v.condicion === "credito").map((v) => v.total),
    abonos: abonos.map((a) => ({ monto: a.monto, medio: a.medio_pago })),
    gastos: gastos.map((g) => ({ monto: g.monto, medio: g.medio_pago })),
    // Solo las compras al contado salen de la caja (igual que en el cierre del día); todas se ven en su hoja.
    compras: compras.filter((c) => c.condicion === "contado").map((c) => ({ monto: c.total, medio: c.medio_pago })),
  });

  const resumen: Hoja = {
    nombre: "Resumen",
    anchos: [38, 20, 16, 16],
    filas: [
      [`Fructus · ${d.rango.etiqueta}`],
      ["Generado el", fecha(generado.toISOString())],
      ["Las ventas anuladas no entran en ningún total. Las horas son de Lima."],
      [],
      ["Ventas registradas", numero(registradas.length)],
      ["Vendido en total", soles(cierre.vendido)],
      ["   al contado", soles(cierre.contado)],
      ["   al crédito", soles(cierre.credito)],
      ["Ventas anuladas (no cuentan)", numero(anuladas.length)],
      ["Abonos cobrados", soles(cierre.abonos)],
      ["Gastos", soles(cierre.gastos)],
      ["Compras al contado", soles(cierre.compras)],
      ["Cajas malogradas (mermas)", numero(redondear(mermas.reduce((s, m) => s + Math.abs(m.cantidad), 0)))],
      [],
      ["Cómo entró y salió la plata", "Entró", "Salió", "Neto"],
      ...cierre.porMedio.map((m): Celda[] => [medios[m.medio], soles(m.entra), soles(m.sale), soles(redondear(m.entra - m.sale))]),
      ["Entró: ventas al contado y abonos. Salió: gastos y compras al contado. Lo vendido al crédito no entra plata hasta que se abona."],
    ],
  };

  const hojaVentas: Hoja = {
    nombre: "Ventas",
    anchos: [18, 9, 28, 12, 16, 14, 12, 26, 26, 34],
    encabezado: 0,
    filas: [
      ["Fecha", "N.º de venta", "Cliente", "Condición", "Medio de pago", "Total", "Estado", "Comprobante", "Estado del comprobante", "Motivo de anulación"],
      ...ventas.map((v): Celda[] => {
        const c = comprobanteAMostrar(v.comprobantes);
        const frase = c ? fraseDeComprobante({ tipo: c.tipo as CodigoTipo, serie: c.serie, numero: c.numero, estado: c.estado }) : null;
        return [
          fecha(v.fecha),
          numero(v.id),
          nombreDelCliente(v.cliente_id),
          condiciones[v.condicion],
          medio(v.medio_pago),
          soles(v.total),
          v.estado === "registrada" ? "Registrada" : "Anulada",
          frase?.titulo ?? null,
          frase?.estado ?? null,
          v.motivo_anulacion,
        ];
      }),
    ],
  };

  const detalle: Hoja = {
    nombre: "Detalle de ventas",
    anchos: [18, 9, 28, 24, 10, 16, 12, 14, 12],
    encabezado: 0,
    filas: [
      ["Fecha", "N.º de venta", "Cliente", "Fruta", "Cajas", "Precio por caja", "Descuento", "Subtotal", "Estado de la venta"],
      ...[...d.items]
        .sort((a, b) => Date.parse(a.venta.fecha) - Date.parse(b.venta.fecha) || a.venta_id - b.venta_id || a.id - b.id)
        .map((i): Celda[] => [
          fecha(i.venta.fecha),
          numero(i.venta_id),
          nombreDelCliente(i.venta.cliente_id),
          nombreDeFruta(productos.get(i.producto_id)),
          numero(i.cantidad),
          soles(i.precio_unitario),
          soles(i.descuento),
          soles(i.subtotal),
          i.venta.estado === "registrada" ? "Registrada" : "Anulada",
        ]),
    ],
  };

  const hojaAbonos: Hoja = {
    nombre: "Abonos",
    anchos: [18, 28, 14, 16, 36],
    encabezado: 0,
    filas: [
      ["Fecha", "Cliente", "Monto", "Medio de pago", "Nota"],
      ...abonos.map((a): Celda[] => [fecha(a.fecha), nombreDelCliente(a.cliente_id), soles(a.monto), medios[a.medio_pago], a.nota]),
    ],
  };

  const hojaCompras: Hoja = {
    nombre: "Compras",
    anchos: [18, 28, 12, 16, 28, 14],
    encabezado: 0,
    filas: [
      ["Fecha", "Proveedor", "Condición", "Medio de pago", "Comprobante del proveedor", "Total"],
      ...compras.map((c): Celda[] => [
        fecha(c.fecha),
        c.proveedor_id === null ? "Sin proveedor" : (proveedores.get(c.proveedor_id)?.nombre ?? "Proveedor que ya no está"),
        condiciones[c.condicion],
        medio(c.medio_pago),
        c.numero_comprobante,
        soles(c.total),
      ]),
    ],
  };

  const hojaGastos: Hoja = {
    nombre: "Gastos",
    anchos: [18, 16, 40, 14, 16],
    encabezado: 0,
    filas: [
      ["Fecha", "Categoría", "Descripción", "Monto", "Medio de pago"],
      ...gastos.map((g): Celda[] => [fecha(g.fecha), categorias[g.categoria] ?? g.categoria, g.descripcion, soles(g.monto), medios[g.medio_pago]]),
    ],
  };

  const hojaMermas: Hoja = {
    nombre: "Mermas",
    anchos: [18, 24, 10, 40],
    encabezado: 0,
    filas: [
      ["Fecha", "Fruta", "Cajas", "Motivo"],
      ...mermas.map((m): Celda[] => [fecha(m.fecha), nombreDeFruta(productos.get(m.producto_id)), numero(Math.abs(m.cantidad)), m.motivo]),
    ],
  };

  return [resumen, hojaVentas, detalle, hojaAbonos, hojaCompras, hojaGastos, hojaMermas];
}
