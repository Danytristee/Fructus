// De la tarjeta de gasto (lo que se entendió) al borrador que la persona corrige, y del borrador a la fila de `gastos`.
// Un gasto es dinero que sale y no es fruta: flete, alquiler, servicios, personal u otros. Lógica pura.
import type { Medio } from "./confirmar-venta-reglas";
import { leerMonto, montoValido } from "./monto-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

type Gasto = Extract<Tarjeta, { tipo: "gasto" }>;

/** Las mismas cinco que acepta la base (gastos.categoria). */
export const CATEGORIAS = ["flete", "alquiler", "servicios", "personal", "otros"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export type BorradorGasto = { categoria: Categoria; monto: number | null; descripcion: string | null; medio: Medio };

/** Un gasto del puesto es de decenas o cientos de soles; el alquiler, de miles. Más que esto es un dedo que se fue. */
export const GASTO_MAXIMO = 50_000;

export const leerGasto = (texto: string) => leerMonto(texto, { nombre: "monto", maximo: GASTO_MAXIMO });

const esCategoria = (c: string): c is Categoria => (CATEGORIAS as readonly string[]).includes(c);

export function borradorGasto(t: Gasto): BorradorGasto {
  return { categoria: esCategoria(t.categoria) ? t.categoria : "otros", monto: t.monto, descripcion: t.descripcion, medio: t.medio };
}

export function faltaGasto(b: BorradorGasto): "monto"[] {
  return montoValido(b.monto, GASTO_MAXIMO) ? [] : ["monto"];
}

export function fueCorregidoGasto(t: Gasto, b: BorradorGasto): boolean {
  return t.categoria !== b.categoria || t.monto !== b.monto || t.medio !== b.medio;
}

export type PedidoGasto = { categoria: Categoria; monto: number; descripcion: string | null; medio_pago: Medio; comando_voz_id: number };

/** La fila que va a `gastos`. null si falta el monto: nunca se guarda un gasto a medias. */
export function pedidoGasto(b: BorradorGasto, comandoId: number): PedidoGasto | null {
  if (faltaGasto(b).length > 0) return null;
  return { categoria: b.categoria, monto: b.monto!, descripcion: b.descripcion, medio_pago: b.medio, comando_voz_id: comandoId };
}
