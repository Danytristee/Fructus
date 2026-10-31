// De la tarjeta de abono (lo que se entendió) al borrador que la persona corrige, y del borrador a la fila de `abonos`.
// Reglas de dinero: un abono siempre es de un cliente, el monto va con dos decimales como máximo, y puede ser mayor que la
// deuda (queda a favor), pero eso se dice en grande antes de Confirmar (decisión del 31-10). Lógica pura.
import type { Medio } from "./confirmar-venta-reglas";
import { leerMonto, montoValido } from "./monto-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Abono = Extract<Tarjeta, { tipo: "abono" }>;

export type BorradorAbono = {
  cliente: { id: number; nombre: string } | null;
  monto: number | null;
  medio: Medio;
};

export type FaltaAbono = "cliente" | "monto";

/** Una deuda de un mayorista llega a miles de soles; más que esto es un dedo que se fue. */
export const ABONO_MAXIMO = 100_000;

const centimos = (n: number) => Math.round(n * 100);

export const leerAbono = (texto: string) => leerMonto(texto, { nombre: "monto", maximo: ABONO_MAXIMO });

export function borradorAbono(t: Abono): BorradorAbono {
  return { cliente: t.cliente.elegido, monto: t.monto, medio: t.medio };
}

/** Lo que falta para poder confirmar, en el orden en que se ve en la tarjeta. */
export function faltaAbono(b: BorradorAbono): FaltaAbono[] {
  const falta: FaltaAbono[] = [];
  if (!b.cliente) falta.push("cliente");
  if (!montoValido(b.monto, ABONO_MAXIMO)) falta.push("monto");
  return falta;
}

const POR_FALTA: Record<FaltaAbono, string> = { cliente: "quién te pagó", monto: "cuánto te dio" };

/** «Falta elegir quién te pagó y cuánto te dio.» */
export function frasesFaltaAbono(falta: FaltaAbono[]): string | null {
  if (falta.length === 0) return null;
  return `Falta elegir ${falta.map((f) => POR_FALTA[f]).join(" y ")}.`;
}

export type SaldoTras = { tipo: "debe"; monto: number } | { tipo: "al_dia" } | { tipo: "a_favor"; monto: number };

/** Cómo queda el cliente después del abono (ley 3: un veredicto, no una cuenta). */
export function saldoTrasAbono(saldo: number, monto: number): SaldoTras {
  const queda = centimos(saldo) - centimos(monto);
  if (queda > 0) return { tipo: "debe", monto: queda / 100 };
  if (queda < 0) return { tipo: "a_favor", monto: -queda / 100 };
  return { tipo: "al_dia" };
}

/** Si la persona cambió algo de lo que se entendió. Elegir el cliente que se preguntó no es corregir. */
export function fueCorregidoAbono(t: Abono, b: BorradorAbono): boolean {
  if (t.cliente.elegido && t.cliente.elegido.id !== b.cliente?.id) return true;
  return t.monto !== b.monto || t.medio !== b.medio;
}

export type PedidoAbono = { cliente_id: number; monto: number; medio_pago: Medio; comando_voz_id: number };

/** La fila que va a `abonos`. null si todavía falta algo: nunca se guarda un abono a medias. */
export function pedidoAbono(b: BorradorAbono, comandoId: number): PedidoAbono | null {
  if (faltaAbono(b).length > 0) return null;
  return { cliente_id: b.cliente!.id, monto: b.monto!, medio_pago: b.medio, comando_voz_id: comandoId };
}
