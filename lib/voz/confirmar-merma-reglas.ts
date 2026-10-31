// De la tarjeta de merma (lo que se entendió) al borrador que la persona corrige, y del borrador a la salida de stock.
// La merma es un comando de primera clase (principio 5): sale del stock con su motivo, nunca como un ajuste escondido.
// Puede dejar el stock en negativo: se permite y se avisa (decisión del 28-10). Lógica pura.
import type { Tarjeta } from "./tarjeta-reglas";

type Merma = Extract<Tarjeta, { tipo: "merma" }>;

export type BorradorMerma = {
  producto: { id: number; nombre: string } | null;
  cantidad: number;
  motivo: string | null;
};

export type FaltaMerma = "producto" | "cantidad";

/** Más cajas que esto es un número mal oído. */
export const CAJAS_MAXIMO = 10_000;

const centimos = (n: number) => Math.round(n * 100);
const cajasValidas = (n: number) => n > 0 && n <= CAJAS_MAXIMO && centimos(n) === n * 100;

export function borradorMerma(t: Merma): BorradorMerma {
  return { producto: t.producto.elegido, cantidad: t.cantidad, motivo: t.motivo };
}

export function faltaMerma(b: BorradorMerma): FaltaMerma[] {
  const falta: FaltaMerma[] = [];
  if (!b.producto) falta.push("producto");
  if (!cajasValidas(b.cantidad)) falta.push("cantidad");
  return falta;
}

const POR_FALTA: Record<FaltaMerma, string> = { producto: "qué fruta se malogró", cantidad: "cuántas cajas" };

/** «Falta elegir qué fruta se malogró.» */
export function frasesFaltaMerma(falta: FaltaMerma[]): string | null {
  if (falta.length === 0) return null;
  return `Falta elegir ${falta.map((f) => POR_FALTA[f]).join(" y ")}.`;
}

/** Cuántas cajas quedan después de la merma. Puede ser negativo: el stock del sistema no conocía todas. */
export function quedanTrasMerma(stock: number, cantidad: number): number {
  return (centimos(stock) - centimos(cantidad)) / 100;
}

/** Si la persona cambió algo de lo que se entendió. Elegir la fruta que se preguntó no es corregir. */
export function fueCorregidaMerma(t: Merma, b: BorradorMerma): boolean {
  if (t.producto.elegido && t.producto.elegido.id !== b.producto?.id) return true;
  return t.cantidad !== b.cantidad;
}

export type PedidoMerma = { producto_id: number; tipo: "merma"; cantidad: number; motivo: string | null; comando_voz_id: number };

/** La fila que va a `movimientos_stock`: la merma resta, así que la cantidad va en negativo. null si falta algo. */
export function pedidoMerma(b: BorradorMerma, comandoId: number): PedidoMerma | null {
  if (faltaMerma(b).length > 0) return null;
  return { producto_id: b.producto!.id, tipo: "merma", cantidad: -b.cantidad, motivo: b.motivo, comando_voz_id: comandoId };
}
