// La deuda en la tarjeta de venta, antes de confirmar (MedidorDeuda): cómo estaba la cuenta del cliente y cómo queda con esta venta.
// El veredicto (debe, al día o a favor) es el mismo de la ficha del cliente (estadoDeuda): una sola regla. Antes, un saldo a favor
// caía en «No debía nada» y la barra usaba un tramo negativo; con S/ 200 a favor y una venta de S/ 450, la tarjeta decía «te debe
// S/ 250.00 · No debía nada · + S/ 450.00» y no cuadraba (/chaos 2026-11-18). Lógica pura.
import { estadoDeuda } from "../ficha-cliente-reglas";
import { formatearSoles } from "../formato";

/** El renglón de abajo, a la izquierda: cómo estaba la cuenta antes de esta venta. */
export function cuentaAntes(saldo: number): string {
  const e = estadoDeuda(saldo);
  if (e.tipo === "debe") return `Debía ${formatearSoles(e.monto)}`;
  if (e.tipo === "a_favor") return `Tenía ${formatearSoles(e.monto)} a favor`;
  return "No debía nada";
}

/**
 * Los dos tramos de la barra, en %: lo que ya debía y lo de hoy. Un saldo a favor no es un tramo (sería negativo): lo que debe sale
 * todo de hoy. null si con esta venta no debe nada, al día o con saldo a favor: no hay deuda que partir.
 */
export function tramosBarra(saldo: number, total: number): { antes: number; hoy: number } | null {
  if (estadoDeuda(saldo + total).tipo !== "debe") return null;
  const antes = Math.max(0, saldo);
  const tope = antes + total;
  return { antes: (100 * antes) / tope, hoy: (100 * total) / tope };
}
