// De la tarjeta de la temperatura (lo que se entendió, o lo que se abre a mano) al borrador que la persona corrige, y del
// borrador a la fila de `temperaturas`. Lógica pura.
import { GRADOS_MAXIMO, GRADOS_MINIMO, redondearGrados, temperaturaValida } from "../temperatura-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Temperatura = Extract<Tarjeta, { tipo: "temperatura" }>;

export type BorradorTemperatura = { grados: number };

export function borradorTemperatura(t: Temperatura): BorradorTemperatura {
  return { grados: redondearGrados(t.grados) };
}

/** Un grado más o uno menos, sin salirse de lo que puede marcar el termómetro. Un «290» mal oído vuelve al rango al primer toque. */
export function moverGrados(b: BorradorTemperatura, paso: number): BorradorTemperatura {
  return { grados: Math.min(GRADOS_MAXIMO, Math.max(GRADOS_MINIMO, redondearGrados(b.grados + paso))) };
}

export function faltaTemperatura(b: BorradorTemperatura): "grados"[] {
  return temperaturaValida(b.grados) ? [] : ["grados"];
}

export function fueCorregidaTemperatura(t: Temperatura, b: BorradorTemperatura): boolean {
  return redondearGrados(t.grados) !== b.grados;
}

export type PedidoTemperatura = { grados: number; comando_voz_id: number };

/** La fila que va a `temperaturas`. null si el número no es una temperatura: nunca se guarda una lectura imposible. */
export function pedidoTemperatura(b: BorradorTemperatura, comandoId: number): PedidoTemperatura | null {
  if (faltaTemperatura(b).length > 0) return null;
  return { grados: b.grados, comando_voz_id: comandoId };
}
