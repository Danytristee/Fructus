// Boleta y factura (A9): cómo se arma el pedido al proveedor, cómo se lee su respuesta y cómo se dice el estado en pantalla.
// Lógica pura: no importa React, Supabase ni la red (lo que habla con el proveedor vive en lucode.ts).
import { z } from "zod";

/** 01 es factura y 03 es boleta (catálogo 01 de SUNAT). */
export type CodigoTipo = "01" | "03";

/** Un comprobante tal como lo ve la pantalla. `estado` es el de la base: pendiente, enviado, aceptado, rechazado o anulado. */
export type ComprobanteVista = { id: number; tipo: CodigoTipo; serie: string; numero: number; estado: string; pdfUrl: string | null };

export const nombreDelTipo = (tipo: CodigoTipo) => (tipo === "01" ? "Factura" : "Boleta");

/** «B001-00000012»: la serie, un guion y el correlativo de 8 cifras. */
export const numeroDeComprobante = (serie: string, numero: number) => `${serie}-${String(numero).padStart(8, "0")}`;

// ---------------------------------------------------------------------------------------------------------------------
// El pedido al proveedor
// ---------------------------------------------------------------------------------------------------------------------

export type DatosDeVenta = {
  /** Día de emisión, `AAAA-MM-DD` en hora de Lima. */
  fecha: string;
  total: number;
  cliente: { tipoDocumento: "DNI" | "RUC" | null; numeroDocumento: string | null; nombre: string } | null;
  items: { descripcion: string; cantidad: number; precioUnitario: number; descuento: number; subtotal: number; afectacionIgv: string }[];
};

export type Emisor = { ruc: string; razonSocial: string };

/**
 * Lo que se le manda a Lucode. La forma exacta es nuestra suposición hasta que se pruebe contra el sandbox real (A9.6): solo
 * `lucode.ts` y esta función conocen su forma, así que ajustarla no toca el resto.
 */
export type PedidoLucode = {
  tipo: CodigoTipo;
  serie: string;
  numero: number;
  fecha_emision: string;
  moneda: "PEN";
  emisor: { ruc: string; razon_social: string };
  /** Catálogo 06 de SUNAT: 1 es DNI, 6 es RUC y 0 es sin documento. */
  cliente: { tipo_documento: "0" | "1" | "6"; numero_documento: string; nombre: string };
  items: { descripcion: string; unidad: string; cantidad: number; precio_unitario: number; valor_venta: number; afectacion_igv: string; igv: number }[];
  totales: { gravado: number; exonerado: number; igv: number; total: number };
};

const TASA_IGV = 118; // el precio de lo gravado trae el 18 % adentro: base = precio × 100 / 118
const enSoles = (centimos: number) => centimos / 100;
const centimos = (soles: number) => Math.round(soles * 100);

/**
 * Arma el pedido con la venta tal como se guardó. Todo se suma en céntimos, como la base: el total del comprobante es el de la
 * venta, al céntimo. Lo exonerado (afectación 20, las frutas frescas) y lo demás que no es gravado va sin IGV; lo gravado (10)
 * trae el IGV de 18 % incluido en el precio, así que se separa la base.
 */
export function armarPedido(referencia: { tipo: CodigoTipo; serie: string; numero: number }, venta: DatosDeVenta, emisor: Emisor): PedidoLucode {
  let gravado = 0;
  let exonerado = 0;
  let igvTotal = 0;
  const items = venta.items.map((i) => {
    const subtotal = centimos(i.subtotal);
    const esGravado = i.afectacionIgv === "10";
    const base = esGravado ? Math.round((subtotal * 100) / TASA_IGV) : subtotal;
    const igv = esGravado ? subtotal - base : 0;
    if (esGravado) gravado += base;
    else exonerado += base;
    igvTotal += igv;
    return {
      descripcion: i.descripcion,
      unidad: "NIU",
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      valor_venta: enSoles(base),
      afectacion_igv: i.afectacionIgv,
      igv: enSoles(igv),
    };
  });

  const c = venta.cliente;
  const cliente: PedidoLucode["cliente"] =
    c?.tipoDocumento && c.numeroDocumento
      ? { tipo_documento: c.tipoDocumento === "RUC" ? "6" : "1", numero_documento: c.numeroDocumento, nombre: c.nombre }
      : { tipo_documento: "0", numero_documento: "-", nombre: c?.nombre ?? "CLIENTES VARIOS" };

  return {
    tipo: referencia.tipo,
    serie: referencia.serie,
    numero: referencia.numero,
    fecha_emision: venta.fecha,
    moneda: "PEN",
    emisor: { ruc: emisor.ruc, razon_social: emisor.razonSocial },
    cliente,
    items,
    totales: { gravado: enSoles(gravado), exonerado: enSoles(exonerado), igv: enSoles(igvTotal), total: enSoles(gravado + exonerado + igvTotal) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// La respuesta del proveedor
// ---------------------------------------------------------------------------------------------------------------------

export type RespuestaDelProveedor =
  | { tipo: "aceptado"; pdfUrl: string | null; xmlUrl: string | null; cruda: unknown }
  | { tipo: "rechazado"; mensaje: string; cruda: unknown }
  | { tipo: "enviado"; cruda: unknown }
  /** No hay respuesta que valga: la red se cayó, pasó el tope de espera, o contestó algo que no se entiende. No se asume nada. */
  | { tipo: "sin-respuesta"; motivo: string };

const cuerpoValido = z.object({
  estado: z.enum(["aceptado", "rechazado", "enviado"]),
  mensaje: z.string().max(500).optional(),
  pdf_url: z.string().optional(),
  xml_url: z.string().optional(),
});

/** Solo se guardan enlaces http o https: lo demás (por ejemplo `javascript:`) nunca llega a un botón. */
function enlaceSeguro(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Lee lo que contestó el proveedor. Solo un éxito del servidor con un cuerpo que se entiende cuenta como respuesta; todo lo
 * demás es «sin respuesta» y el comprobante se queda pendiente para reintentarlo (nunca se da por aceptado ni por rechazado
 * algo que no se entendió).
 */
export function leerRespuesta(estadoHttp: number, cuerpo: unknown): RespuestaDelProveedor {
  if (estadoHttp < 200 || estadoHttp >= 300) return { tipo: "sin-respuesta", motivo: `El proveedor respondió ${estadoHttp}` };
  const leido = cuerpoValido.safeParse(cuerpo);
  if (!leido.success) return { tipo: "sin-respuesta", motivo: "La respuesta del proveedor no se entendió" };
  const r = leido.data;
  if (r.estado === "aceptado") return { tipo: "aceptado", pdfUrl: enlaceSeguro(r.pdf_url), xmlUrl: enlaceSeguro(r.xml_url), cruda: cuerpo };
  if (r.estado === "rechazado") return { tipo: "rechazado", mensaje: r.mensaje ?? "El proveedor rechazó el comprobante", cruda: cuerpo };
  return { tipo: "enviado", cruda: cuerpo };
}

// ---------------------------------------------------------------------------------------------------------------------
// Cómo se ve
// ---------------------------------------------------------------------------------------------------------------------

/** El comprobante que vale para una venta: pendiente, enviado o aceptado. Uno rechazado o anulado ya no cuenta (INV-08). */
export function comprobanteVigente<T extends { estado: string }>(comprobantes: T[]): T | null {
  return comprobantes.find((c) => c.estado === "pendiente" || c.estado === "enviado" || c.estado === "aceptado") ?? null;
}

const estados: Record<string, string> = {
  aceptado: "aceptada",
  enviado: "enviada, esperando a SUNAT",
  pendiente: "en proceso",
  rechazado: "rechazada",
  anulado: "anulada",
};

/** «Boleta B001-00000012» y en qué quedó: «aceptada», «enviada, esperando a SUNAT» o «en proceso». */
export function fraseDeComprobante(c: { tipo: CodigoTipo; serie: string; numero: number; estado: string }): { titulo: string; estado: string } {
  return { titulo: `${nombreDelTipo(c.tipo)} ${numeroDeComprobante(c.serie, c.numero)}`, estado: estados[c.estado] ?? c.estado };
}

/** Qué se le ofrece a quien mira una venta para la factura: sale directo, hay que pedir el RUC, o no se ofrece. */
export type OfertaDeFactura = "emitir" | "pedir-ruc" | null;

/**
 * La factura es solo para clientes con RUC (INV-11). A una venta al paso no se le ofrece: no tiene a quién. A un cliente sin documento
 * se le pide el RUC, pero solo quien puede editar clientes (el dueño y el administrador; la RLS también lo exige). A un cliente con DNI
 * tampoco: su documento no se pisa sin avisar, se cambia en su ficha.
 */
export function ofertaDeFactura(cliente: { tipoDocumento: "DNI" | "RUC" | null } | null, puedeEditarClientes: boolean): OfertaDeFactura {
  if (!cliente) return null;
  if (cliente.tipoDocumento === "RUC") return "emitir";
  if (cliente.tipoDocumento === null && puedeEditarClientes) return "pedir-ruc";
  return null;
}
