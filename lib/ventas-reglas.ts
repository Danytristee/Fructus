// El historial de ventas y el detalle de una venta (A8): cómo se cuenta el período, cómo se dice el pago y cómo se lee cada
// fruta de la venta. Lógica pura: no importa React ni Supabase.
import { medios, type Medio } from "./operaciones-reglas";

export type ItemDeVenta = { producto: string; cantidad: number; precio: number; descuento: number; subtotal: number };

/** Todo lo que la hoja de una venta muestra, ya leído: sin pedir nada más al servidor al tocarla. */
export type DetalleVenta = {
  id: number;
  fecha: string;
  total: number;
  condicion: "contado" | "credito";
  medio: Medio | null;
  cliente: { id: number; nombre: string } | null;
  items: ItemDeVenta[];
  /** Quién la registró, si se puede ver (el ayudante no lee los perfiles de los demás). */
  registradaPor: string | null;
};

export type Periodo = "hoy" | "semana";

export type ResumenPeriodo = { ventas: number; total: number; contado: number; credito: number };

const centimos = (n: number) => Math.round(n * 100);

/** Cuánto se vendió en un período y cuánto de eso se cobró y cuánto se fió, sumado en céntimos para que cuadre con la base. */
export function resumirPeriodo(ventas: { total: number; credito: boolean }[]): ResumenPeriodo {
  let contado = 0;
  let credito = 0;
  for (const v of ventas) {
    if (v.credito) credito += centimos(v.total);
    else contado += centimos(v.total);
  }
  return { ventas: ventas.length, total: (contado + credito) / 100, contado: contado / 100, credito: credito / 100 };
}

/** «Pagó en efectivo», «Pagó con Yape», «Lo debe». Una venta al contado sin medio solo dice que pagó. */
export function fraseDePago(v: { condicion: "contado" | "credito"; medio: Medio | null }): string {
  if (v.condicion === "credito") return "Lo debe";
  return v.medio ? `Pagó ${medios[v.medio]}` : "Pagó";
}

/** La fruta de una venta en una línea de puesto: «10 cajas de mango kent a S/ 45.00 la caja». */
export function lineaDeFruta(i: ItemDeVenta, soles: (n: number) => string): { titulo: string; detalle: string } {
  const cajas = `${Number.isInteger(i.cantidad) ? i.cantidad : i.cantidad.toLocaleString("es-PE")} ${i.cantidad === 1 ? "caja" : "cajas"}`;
  const rebaja = i.descuento > 0 ? `, con ${soles(i.descuento)} de rebaja` : "";
  return { titulo: `${cajas} de ${i.producto.toLowerCase()}`, detalle: `${soles(i.precio)} la caja${rebaja}` };
}

/** Qué se dice arriba del historial: «Hoy vendiste» o «En 7 días vendiste». */
export const etiquetaDelPeriodo = (p: Periodo) => (p === "hoy" ? "Hoy vendiste" : "En 7 días vendiste");
