// De la tarjeta de venta (lo que se entendió) al borrador que la persona corrige, y del borrador a lo que recibe
// registrar_venta. Reglas de dinero (CLAUDE.md, principio 2): no se guarda sin precio, sin saber si pagó, ni al crédito
// sin cliente; la rebaja dicha para toda la venta se reparte entre las frutas según su peso en el total. Lógica pura.
import { leerMonto } from "./monto-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Venta = Extract<Tarjeta, { tipo: "venta" }>;
export type Medio = "efectivo" | "yape" | "plin" | "transferencia";

export type ItemBorrador = {
  productoId: number | null;
  /** El nombre elegido, o lo que se dijo mientras no se elija. */
  producto: string;
  cantidad: number;
  precio: number | null;
  /** El precio no se dijo: se puso el último cobrado (o el de referencia). */
  sugerido: boolean;
};

export type Borrador = {
  cliente: { id: number; nombre: string } | null;
  items: ItemBorrador[];
  descuento: number;
  condicion: "contado" | "credito" | null;
  medio: Medio | null;
  /** Lo que se pidió al dictar («… factura») y la persona puede cambiar. No frena la venta: si el comprobante no puede salir, la venta igual se guarda. */
  comprobante: "ninguno" | "boleta" | "factura";
};

export type Falta = "cliente" | "producto" | "cantidad" | "precio" | "condicion";

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Una caja de fruta cuesta decenas o cientos de soles: más que esto es un dedo que se fue (/chaos 2026-10-29). */
export const PRECIO_MAXIMO = 10_000;

/**
 * Lo que se escribió en «Precio de la caja» (lib/voz/monto-reglas.ts). La base también rechaza más de dos decimales
 * (20261029162351_montos_en_centimos).
 */
export const leerPrecio = (texto: string) => leerMonto(texto, { nombre: "precio", maximo: PRECIO_MAXIMO, unidad: "por caja" });

export function borradorDe(t: Venta): Borrador {
  return {
    cliente: t.cliente.elegido,
    items: t.items.map((it) => ({
      productoId: it.producto.elegido?.id ?? null,
      producto: it.producto.elegido?.nombre ?? it.producto.dicho ?? "",
      cantidad: it.cantidad,
      precio: it.precio.valor,
      sugerido: it.precio.sugerido,
    })),
    descuento: t.descuento,
    condicion: t.condicion,
    medio: t.condicion === "contado" ? (t.medio ?? "efectivo") : null,
    comprobante: t.comprobante,
  };
}

/** El total que se va a guardar; null mientras falte algún precio. */
export function totalDe(b: Borrador): number | null {
  if (b.items.some((it) => it.precio === null)) return null;
  return Math.max(0, redondear(b.items.reduce((s, it) => s + it.cantidad * (it.precio ?? 0), 0) - b.descuento));
}

/** Lo que falta para poder confirmar, en el orden en que se ve en la tarjeta. */
export function faltaDe(b: Borrador): Falta[] {
  const falta: Falta[] = [];
  // Al crédito hay que saber quién debe (la base también lo exige: venta_credito_requiere_cliente).
  if (b.condicion === "credito" && !b.cliente) falta.push("cliente");
  if (b.items.length === 0 || b.items.some((it) => it.productoId === null)) falta.push("producto");
  if (b.items.some((it) => !(it.cantidad > 0))) falta.push("cantidad");
  // Precio 0 cuenta como que falta: una venta de S/ 0.00 es casi siempre un precio sin poner (/chaos 2026-10-29).
  if (b.items.some((it) => it.precio === null || !(it.precio > 0) || it.precio > PRECIO_MAXIMO)) falta.push("precio");
  if (b.condicion === null) falta.push("condicion");
  return falta;
}

const POR_FALTA: Record<Falta, string> = {
  cliente: "a quién le fiaste",
  producto: "qué fruta fue",
  cantidad: "cuántas cajas",
  precio: "a cuánto la caja",
  condicion: "si pagó o lo debe",
};

/** «Falta decir a cuánto la caja y si pagó o lo debe.» */
export function frasesFalta(falta: Falta[]): string | null {
  if (falta.length === 0) return null;
  const partes = falta.map((f) => POR_FALTA[f]);
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
  return `Falta elegir ${lista}.`;
}

/**
 * Reparte la rebaja de toda la venta entre los ítems, proporcional a su subtotal, en céntimos. Lo que sobra del redondeo
 * va al ítem más grande. Ningún ítem queda con una rebaja mayor que su subtotal (la base lo exige).
 */
export function repartirDescuento(subtotales: number[], descuento: number): number[] {
  const total = subtotales.reduce((s, x) => s + x, 0);
  const tope = Math.min(redondear(descuento), redondear(total));
  if (tope <= 0 || total <= 0) return subtotales.map(() => 0);
  const partes = subtotales.map((x) => Math.floor((x / total) * tope * 100) / 100);
  const resto = redondear(tope - partes.reduce((s, x) => s + x, 0));
  const mayor = subtotales.indexOf(Math.max(...subtotales));
  partes[mayor] = redondear(partes[mayor]! + resto);
  return partes;
}

/** Si la persona cambió algo de lo que se entendió (sirve para medir la precisión real del intérprete). */
export function fueCorregido(t: Venta, b: Borrador): boolean {
  const original = borradorDe(t);
  if ((original.cliente?.id ?? null) !== (b.cliente?.id ?? null)) return true;
  if (original.items.length !== b.items.length) return true;
  if (original.items.some((it, n) => it.productoId !== b.items[n]!.productoId || it.cantidad !== b.items[n]!.cantidad || it.precio !== b.items[n]!.precio))
    return true;
  // Elegir cuando se preguntó no es corregir; cambiar lo que se dijo, sí.
  if (original.condicion !== null && original.condicion !== b.condicion) return true;
  if (original.comprobante !== b.comprobante) return true;
  return original.condicion !== null && original.medio !== b.medio;
}

export type PedidoVenta = {
  cliente_id: number | null;
  condicion: "contado" | "credito";
  medio_pago: Medio | null;
  comando_voz_id: number;
  corregido: boolean;
  items: { producto_id: number; cantidad: number; precio_unitario: number; descuento: number }[];
};

/**
 * Lo que recibe registrar_venta. null si todavía falta algo: nunca se guarda una venta a medias. Corre en el servidor
 * con el borrador que manda el celular; `corregido` lo calcula el celular, que tiene la tarjeta original (fueCorregido).
 */
export function pedidoVenta(b: Borrador, comandoId: number, corregido: boolean): PedidoVenta | null {
  if (faltaDe(b).length > 0) return null;
  const subtotales = b.items.map((it) => redondear(it.cantidad * it.precio!));
  const descuentos = repartirDescuento(subtotales, b.descuento);
  return {
    cliente_id: b.cliente?.id ?? null,
    condicion: b.condicion!,
    medio_pago: b.condicion === "contado" ? (b.medio ?? "efectivo") : null,
    comando_voz_id: comandoId,
    corregido,
    items: b.items.map((it, n) => ({ producto_id: it.productoId!, cantidad: it.cantidad, precio_unitario: it.precio!, descuento: descuentos[n]! })),
  };
}
