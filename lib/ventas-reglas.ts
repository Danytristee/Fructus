// El historial de ventas y el detalle de una venta (A8): cómo se cuenta el período, cómo se dice el pago y cómo se lee cada
// fruta de la venta. Lógica pura: no importa React ni Supabase.
import type { ComprobanteVista } from "./comprobantes/comprobante-reglas";
import { medios, type Medio } from "./operaciones-reglas";

export type ItemDeVenta = { producto: string; cantidad: number; precio: number; descuento: number; subtotal: number };

/** Todo lo que la hoja de una venta muestra, ya leído: sin pedir nada más al servidor al tocarla. */
export type DetalleVenta = {
  id: number;
  fecha: string;
  total: number;
  condicion: "contado" | "credito";
  medio: Medio | null;
  /** `tipoDocumento` decide si se le puede hacer factura (solo con RUC). */
  cliente: { id: number; nombre: string; tipoDocumento: "DNI" | "RUC" | null; telefono: string | null } | null;
  items: ItemDeVenta[];
  /** Quién la registró, si se puede ver (el ayudante no lee los perfiles de los demás). */
  registradaPor: string | null;
  /** Si está anulada: cuándo, quién (si se puede ver) y por qué. null mientras vale. */
  anulacion: { cuando: string; por: string | null; motivo: string } | null;
  /** Su boleta o factura vigente (pendiente, enviada o aceptada), si ya se emitió. */
  comprobante: ComprobanteVista | null;
  /** Al crédito, lo que pagó al llevarse la fruta («pagó solo 1000», ADR-0023). null o ausente si no pagó nada al llevar. */
  pagoAlLlevar?: { monto: number; medio: Medio } | null;
};

export type Periodo = "hoy" | "semana";

/** `ventas` es cuántas hay; `ventasContado` y `ventasCredito`, cuántas de cada tipo (lo que cuentan los filtros del historial). */
export type ResumenPeriodo = { ventas: number; total: number; contado: number; credito: number; ventasContado: number; ventasCredito: number };

const centimos = (n: number) => Math.round(n * 100);

/** Cuánto se vendió en un período y cuánto de eso se cobró y cuánto se fió, sumado en céntimos para que cuadre con la base. */
export function resumirPeriodo(ventas: { total: number; credito: boolean }[]): ResumenPeriodo {
  let contado = 0;
  let credito = 0;
  let ventasCredito = 0;
  for (const v of ventas) {
    if (v.credito) {
      credito += centimos(v.total);
      ventasCredito += 1;
    } else contado += centimos(v.total);
  }
  return {
    ventas: ventas.length,
    total: (contado + credito) / 100,
    contado: contado / 100,
    credito: credito / 100,
    ventasContado: ventas.length - ventasCredito,
    ventasCredito,
  };
}

/** Lo mínimo de una venta para sumarla sin traer su detalle (fruta, precios, quién la registró). */
export type FilaDeVenta = { fecha: string; total: number; condicion: "contado" | "credito"; estado: string };

/** Lo de un día para su cabecera en el historial: ventas que valen, anuladas y cuánto sumaron. */
export type ResumenDeDia = { ventas: number; anuladas: number; total: number };

export type ResumenesDeVentas = {
  /** Lo vendido «Hoy» y en «7 días» (estos incluyen hoy). Las anuladas no suman ni cuentan. */
  resumenes: Record<Periodo, ResumenPeriodo>;
  /** Cuántas filas hay en cada período, anuladas incluidas: sirve para saber si la lista las muestra todas. */
  filas: Record<Periodo, number>;
  /** Por día de Lima. Si la lista se corta, la cabecera del día más viejo sigue diciendo lo que de verdad se vendió ese día. */
  porDia: Record<string, ResumenDeDia>;
};

/**
 * Suma «Hoy» y «7 días» sobre TODAS las ventas del rango. El historial muestra a lo sumo las últimas N (para no cargar de más), pero
 * los totales no pueden salir de esa lista: con más ventas que N, «En 7 días vendiste» saldría bajo sin avisar (principios 2 y 4).
 * `diaDe` dice a qué día de Lima pertenece una fecha.
 */
export function resumirVentas(filas: FilaDeVenta[], hoy: string, diaDe: (fecha: string) => string): ResumenesDeVentas {
  const vigentes = (de: FilaDeVenta[]) => de.filter((f) => f.estado !== "anulada").map((f) => ({ total: f.total, credito: f.condicion === "credito" }));
  const deHoy = filas.filter((f) => diaDe(f.fecha) === hoy);
  const porDia: Record<string, ResumenDeDia> = {};
  for (const f of filas) {
    const dia = (porDia[diaDe(f.fecha)] ??= { ventas: 0, anuladas: 0, total: 0 });
    if (f.estado === "anulada") dia.anuladas += 1;
    else {
      dia.ventas += 1;
      dia.total = (Math.round(dia.total * 100) + centimos(f.total)) / 100;
    }
  }
  return {
    resumenes: { hoy: resumirPeriodo(vigentes(deHoy)), semana: resumirPeriodo(vigentes(filas)) },
    filas: { hoy: deHoy.length, semana: filas.length },
    porDia,
  };
}

/** «Pagó en efectivo», «Pagó con Yape», «Lo debe», «Debe el resto». Una venta al contado sin medio solo dice que pagó. */
export function fraseDePago(v: { condicion: "contado" | "credito"; medio: Medio | null; pagoAlLlevar?: DetalleVenta["pagoAlLlevar"] }): string {
  if (v.condicion === "credito") return v.pagoAlLlevar ? "Debe el resto" : "Lo debe";
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
