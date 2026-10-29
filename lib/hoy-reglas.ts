// Las reglas de la pantalla «Hoy»: qué se cuenta como cobrado, cómo se arma el día por horas y la curva del gráfico.
// Lógica pura: no importa React ni Supabase.
import { z } from "zod";

import { formatearCajas } from "./formato";

const numero = z.coerce.number();

// Lo que devuelve resumen_dia(). Se valida antes de usarlo: si la base cambia una llave, se dice aquí y no en pantalla.
const esquemaResumen = z.object({
  ventas_total: numero,
  ventas_contado: numero,
  abonos: numero,
  por_cobrar_total: numero,
  numero_ventas: numero,
  cajas_vendidas: numero,
});

export type ResumenHoy = {
  vendido: number;
  /** Lo que entró a la caja hoy: ventas al contado más abonos. Lo vendido al crédito no se cobró. */
  cobrado: number;
  /** Todo lo que deben los clientes, de hoy y de antes. */
  porCobrar: number;
  numeroVentas: number;
  cajas: number;
};

export function leerResumen(datos: unknown): ResumenHoy {
  const r = esquemaResumen.parse(datos);
  return {
    vendido: r.ventas_total,
    cobrado: r.ventas_contado + r.abonos,
    porCobrar: r.por_cobrar_total,
    numeroVentas: r.numero_ventas,
    cajas: r.cajas_vendidas,
  };
}

/** «58 cajas en 9 ventas», «1 caja en 1 venta». */
export function textoVentas(numeroVentas: number, cajas: number): string {
  return `${formatearCajas(cajas)} en ${numeroVentas} ${numeroVentas === 1 ? "venta" : "ventas"}`;
}

// Lima no cambia de horario: siempre es UTC−5.
const LIMA_MS = -5 * 60 * 60 * 1000;

/** La medianoche de hoy en Lima, como instante ISO, para filtrar «lo de hoy» en la base. */
export function inicioDelDiaLima(ahora: Date): string {
  const lima = new Date(ahora.getTime() + LIMA_MS);
  return `${lima.toISOString().slice(0, 10)}T00:00:00-05:00`;
}

function horaLima(fecha: Date): number {
  return new Date(fecha.getTime() + LIMA_MS).getUTCHours();
}

export type HoraVentas = { hora: number; total: number };

/**
 * Lo vendido en cada hora de hoy, desde las 6 a. m. (o desde la primera venta, si fue antes) hasta la hora actual.
 * Las horas sin ventas cuentan como 0: el gráfico muestra también los ratos flojos.
 */
export function ventasPorHora(ventas: { fecha: string; total: number }[], ahora: Date): HoraVentas[] {
  if (ventas.length === 0) return [];
  const horas = ventas.map((v) => horaLima(new Date(v.fecha)));
  const desde = Math.min(6, ...horas);
  const hasta = Math.max(horaLima(ahora), ...horas);
  const totales = new Map<number, number>();
  ventas.forEach((v, i) => totales.set(horas[i]!, (totales.get(horas[i]!) ?? 0) + v.total));
  return Array.from({ length: hasta - desde + 1 }, (_, k) => ({ hora: desde + k, total: totales.get(desde + k) ?? 0 }));
}

/** La hora en que más se vendió (la primera, si empatan). */
export function horaPico(horas: HoraVentas[]): number | null {
  if (horas.length === 0) return null;
  return horas.reduce((pico, h) => (h.total > pico.total ? h : pico)).hora;
}

/** Lo vendido hasta el final de cada hora: la línea del gráfico sube con cada venta y termina en «Vendiste hoy». */
export function acumulado(horas: HoraVentas[]): HoraVentas[] {
  let suma = 0;
  return horas.map((h) => ({ hora: h.hora, total: (suma += h.total) }));
}

export type Curva = { linea: string; area: string; fin: { x: number; y: number } };

/**
 * La curva suave del gráfico en un lienzo de ancho × alto. Es monótona (Fritsch-Carlson): pasa por cada punto y nunca
 * sube ni baja más de lo que dicen los datos, así no dibuja ventas que no hubo. Con menos de dos horas no hay curva.
 */
export function curvaDelDia(horas: HoraVentas[], ancho = 320, alto = 96, margen = 8): Curva | null {
  if (horas.length < 2) return null;
  const maximo = Math.max(...horas.map((h) => h.total)) || 1;
  const x = horas.map((_, i) => margen + (i * (ancho - 2 * margen)) / (horas.length - 1));
  const y = horas.map((h) => alto - margen - (h.total / maximo) * (alto - 2 * margen - 6));
  const n = horas.length;

  // Pendientes entre puntos y tangentes en cada punto, recortadas para no pasarse.
  const d = Array.from({ length: n - 1 }, (_, i) => (y[i + 1]! - y[i]!) / (x[i + 1]! - x[i]!));
  const m = y.map((_, i) => {
    if (i === 0) return d[0]!;
    if (i === n - 1) return d[n - 2]!;
    const a = d[i - 1]!;
    const b = d[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });

  const r = (v: number) => Math.round(v * 10) / 10;
  let linea = `M${r(x[0]!)},${r(y[0]!)}`;
  for (let i = 0; i < n - 1; i++) {
    const tramo = (x[i + 1]! - x[i]!) / 3;
    linea += ` C${r(x[i]! + tramo)},${r(y[i]! + m[i]! * tramo)} ${r(x[i + 1]! - tramo)},${r(y[i + 1]! - m[i + 1]! * tramo)} ${r(x[i + 1]!)},${r(y[i + 1]!)}`;
  }
  const fin = { x: r(x[n - 1]!), y: r(y[n - 1]!) };
  return { linea, area: `${linea} L${fin.x},${alto} L${r(x[0]!)},${alto} Z`, fin };
}
