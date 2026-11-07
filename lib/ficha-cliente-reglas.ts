// La ficha de un cliente (A8): su veredicto de deuda, su historial día por día y cómo llamarlo. Lógica pura: no importa
// React ni Supabase.
import { diaDeLima, formatearFecha, formatearHace } from "./formato";
import { deAbono, deVenta, type AbonoLeido, type Operacion, type VentaLeida } from "./operaciones-reglas";

/** Cuántos movimientos se muestran en la ficha; para más, está la lista de Ventas. */
export const HISTORIAL_TOPE = 40;

export type EstadoDeuda = { tipo: "debe"; monto: number } | { tipo: "al_dia" } | { tipo: "a_favor"; monto: number };

/** Ley 3: la cuenta se traduce a un veredicto. Se compara en céntimos para que 0.1 + 0.2 − 0.3 sea «al día». */
export function estadoDeuda(saldo: number): EstadoDeuda {
  const centimos = Math.round(saldo * 100);
  if (centimos > 0) return { tipo: "debe", monto: centimos / 100 };
  if (centimos < 0) return { tipo: "a_favor", monto: -centimos / 100 };
  return { tipo: "al_dia" };
}

/** Qué parte de todo lo que te deben es de este cliente, de 0 a 100. */
export function parteDeLaDeuda(saldo: number, deudaTotal: number): number {
  if (saldo <= 0 || deudaTotal <= 0) return 0;
  return Math.min(100, Math.round((100 * saldo) / deudaTotal));
}

const horaLima = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Lima" });

/** «3:15 p. m.», con la hora de Lima aunque el servidor esté en otra zona. Los espacios son duros: «p. m.» no se parte. */
export function horaDeLima(fecha: Date): string {
  return horaLima.format(fecha).replace(/\s/g, " ");
}

/** «hoy», «ayer» o «martes 28 de octubre». */
export function etiquetaDeDia(fecha: Date, ahora: Date): string {
  const hace = formatearHace(fecha, ahora);
  return hace === "hoy" || hace === "ayer" ? hace : formatearFecha(fecha);
}

export type DiaOperaciones = { dia: string; etiqueta: string; operaciones: Operacion[] };

// En la ficha todas las filas son de la misma persona: repetir su cara y su nombre en cada una es ruido (ley 8). La fila
// dice qué pasó y a qué hora; el día va en el encabezado del grupo.
function paraLaFicha(op: Operacion, fecha: Date): Operacion {
  return { ...op, titulo: op.detalle, detalle: horaDeLima(fecha), persona: null };
}

/**
 * Las ventas y los abonos de un cliente, de lo más reciente a lo más viejo y agrupados por día de Lima. Quien lee pide
 * `tope + 1` de cada tabla: si llega más de `tope`, hay más y se avisa.
 */
export function historialDelCliente(
  entrada: { ventas: VentaLeida[]; abonos: AbonoLeido[] },
  ahora: Date,
  tope: number = HISTORIAL_TOPE,
): { dias: DiaOperaciones[]; hayMas: boolean } {
  const todas = [...entrada.ventas.map(deVenta), ...entrada.abonos.map(deAbono)].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const dias = new Map<string, DiaOperaciones>();
  for (const op of todas.slice(0, tope)) {
    const fecha = new Date(op.fecha);
    const dia = diaDeLima(fecha);
    if (!dias.has(dia)) dias.set(dia, { dia, etiqueta: etiquetaDeDia(fecha, ahora), operaciones: [] });
    dias.get(dia)!.operaciones.push(paraLaFicha(op, fecha));
  }
  return { dias: [...dias.values()], hayMas: todas.length > tope };
}

/** `tel:` para llamar con un toque; null si el número no sirve (vacío o con letras). */
export function enlaceDeLlamada(telefono: string | null): string | null {
  const limpio = (telefono ?? "").replace(/[\s\-().]/g, "");
  return /^\+?\d{6,15}$/.test(limpio) ? `tel:${limpio}` : null;
}
