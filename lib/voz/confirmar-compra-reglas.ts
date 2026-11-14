// De la tarjeta de compra (lo que se entendió) al borrador que la persona corrige, y del borrador a lo que recibe
// registrar_compra. Reglas de dinero (principio 2): no se guarda sin costo, sin saber si se pagó (nunca se asume
// contado), ni al crédito sin proveedor. Lógica pura.
import { maduraEnLaCaja, type EstadoLlegada } from "../vida-util-reglas";
import { PRECIO_MAXIMO, type ItemBorrador, type Medio } from "./confirmar-venta-reglas";
import { leerMonto } from "./monto-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Compra = Extract<Tarjeta, { tipo: "compra" }>;

/** Los ítems son los mismos que en la venta: `precio` es el costo por caja y `sugerido` dice que no se dijo. */
export type BorradorCompra = {
  proveedor: { id: number; nombre: string } | null;
  items: ItemBorrador[];
  condicion: "contado" | "credito" | null;
  medio: Medio | null;
};

export type FaltaCompra = "proveedor" | "producto" | "cantidad" | "costo" | "condicion";

const centimos = (n: number) => Math.round(n * 100);

export const leerCosto = (texto: string) => leerMonto(texto, { nombre: "costo", maximo: PRECIO_MAXIMO, unidad: "por caja" });

export function borradorCompra(t: Compra): BorradorCompra {
  return {
    proveedor: t.proveedor.elegido,
    items: t.items.map((it) => ({
      productoId: it.producto.elegido?.id ?? null,
      producto: it.producto.elegido?.nombre ?? it.producto.dicho ?? "",
      cantidad: it.cantidad,
      precio: it.costo.valor,
      sugerido: it.costo.sugerido,
      estado: it.estado ?? null,
    })),
    condicion: t.condicion,
    medio: t.condicion === "contado" ? "efectivo" : null,
  };
}

/** Lo que se va a pagar (o deber): la suma ítem por ítem en céntimos, igual que registrar_compra. null si falta un costo. */
export function totalCompra(b: BorradorCompra): number | null {
  if (b.items.some((it) => it.precio === null)) return null;
  return b.items.reduce((s, it) => s + Math.round(it.cantidad * it.precio! * 100), 0) / 100;
}

/** Lo que falta para poder confirmar, en el orden en que se ve en la tarjeta. */
export function faltaCompra(b: BorradorCompra): FaltaCompra[] {
  const falta: FaltaCompra[] = [];
  if (b.condicion === "credito" && !b.proveedor) falta.push("proveedor");
  if (b.items.length === 0 || b.items.some((it) => it.productoId === null)) falta.push("producto");
  if (b.items.some((it) => !(it.cantidad > 0) || centimos(it.cantidad) !== it.cantidad * 100)) falta.push("cantidad");
  // Costo 0 cuenta como que falta, igual que el precio en la venta: casi siempre es un costo sin poner.
  if (b.items.some((it) => it.precio === null || !(it.precio > 0) || it.precio > PRECIO_MAXIMO)) falta.push("costo");
  if (b.condicion === null) falta.push("condicion");
  return falta;
}

const POR_FALTA: Record<FaltaCompra, string> = {
  proveedor: "a quién le debes",
  producto: "qué fruta fue",
  cantidad: "cuántas cajas",
  costo: "a cuánto la caja",
  condicion: "si la pagaste o la debes",
};

/** «Falta elegir a cuánto la caja y si la pagaste o la debes.» */
export function frasesFaltaCompra(falta: FaltaCompra[]): string | null {
  if (falta.length === 0) return null;
  const partes = falta.map((f) => POR_FALTA[f]);
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
  return `Falta elegir ${lista}.`;
}

/** Si la persona cambió algo de lo que se entendió. Elegir cuando se preguntó no es corregir. */
export function fueCorregidaCompra(t: Compra, b: BorradorCompra): boolean {
  const original = borradorCompra(t);
  if (original.proveedor && original.proveedor.id !== b.proveedor?.id) return true;
  if (original.items.length !== b.items.length) return true;
  if (original.items.some((it, n) => (it.productoId !== null && it.productoId !== b.items[n]!.productoId) || it.cantidad !== b.items[n]!.cantidad))
    return true;
  if (original.items.some((it, n) => !it.sugerido && it.precio !== null && it.precio !== b.items[n]!.precio)) return true;
  // Cambiar cómo llegó lo que se dijo es corregir; elegirlo cuando no se dijo, no.
  if (original.items.some((it, n) => it.estado != null && it.estado !== (b.items[n]!.estado ?? null))) return true;
  if (original.condicion !== null && original.condicion !== b.condicion) return true;
  return original.condicion === "contado" && original.medio !== b.medio;
}

export type PedidoCompra = {
  proveedor_id: number | null;
  condicion: "contado" | "credito";
  medio_pago: Medio | null;
  comando_voz_id: number;
  corregido: boolean;
  items: { producto_id: number; cantidad: number; costo_unitario: number; estado_llegada: EstadoLlegada | null }[];
};

/** Lo que recibe registrar_compra. null si todavía falta algo: nunca se guarda una compra a medias. */
export function pedidoCompra(b: BorradorCompra, comandoId: number, corregido: boolean): PedidoCompra | null {
  if (faltaCompra(b).length > 0) return null;
  return {
    proveedor_id: b.proveedor?.id ?? null,
    condicion: b.condicion!,
    medio_pago: b.condicion === "contado" ? (b.medio ?? "efectivo") : null,
    comando_voz_id: comandoId,
    corregido,
    // Cómo llegó solo se guarda en la fruta que madura en la caja: en las demás no cambia nada.
    items: b.items.map((it) => ({ producto_id: it.productoId!, cantidad: it.cantidad, costo_unitario: it.precio!, estado_llegada: maduraEnLaCaja(it.producto) ? (it.estado ?? null) : null })),
  };
}
