// Lo que Fructus dice en manos libres al abrir la tarjeta de un abono, una merma, un gasto o una compra (ADR-0020): la misma idea que
// la venta (lib/voz/lectura-reglas.ts). Se lee lo que se va a guardar y se pregunta «¿Confirmo?»; si falta saber si la compra se pagó,
// se pregunta primero; con dudas o si falta otro dato, solo se avisa y se confirma con el dedo. Lógica pura.
import { faltaAbono, frasesFaltaAbono, type BorradorAbono } from "./confirmar-abono-reglas";
import { faltaCompra, frasesFaltaCompra, totalCompra, type BorradorCompra } from "./confirmar-compra-reglas";
import { faltaGasto, type BorradorGasto } from "./confirmar-gasto-reglas";
import { faltaMerma, frasesFaltaMerma, type BorradorMerma } from "./confirmar-merma-reglas";
import { MEDIOS_HABLADOS, cajasHabladas, dudaHablada, nombreHablado, precioHablado, solesHablados, type Guion } from "./lectura-reglas";

const avisar = (falta: string | null): Guion => ({ pregunta: "ninguna", texto: `${falta ?? "Falta un dato."} Míralo en la tarjeta.` });

/** «Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?» */
export function guionAbono(b: BorradorAbono, dudas: string[]): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada("este abono") };
  const falta = faltaAbono(b);
  if (falta.length > 0 || !b.cliente || b.monto === null) return avisar(frasesFaltaAbono(falta));
  return { pregunta: "confirmar", texto: `Abono de ${b.cliente.nombre}: ${solesHablados(b.monto)} ${MEDIOS_HABLADOS[b.medio]}. ¿Confirmo?` };
}

/** «Merma: 3 cajas de Mango Kent, se malograron. ¿Confirmo?» */
export function guionMerma(b: BorradorMerma): Guion {
  const falta = faltaMerma(b);
  if (falta.length > 0 || !b.producto) return avisar(frasesFaltaMerma(falta));
  const motivo = b.motivo?.trim() ? `, ${b.motivo.trim().replace(/[.。]+$/, "")}` : "";
  return { pregunta: "confirmar", texto: `Merma: ${cajasHabladas(b.cantidad)} de ${nombreHablado(b.producto.nombre)}${motivo}. ¿Confirmo?` };
}

/** «Gasto de flete, al cargador: 50 soles en efectivo. ¿Confirmo?» */
export function guionGasto(b: BorradorGasto): Guion {
  if (faltaGasto(b).length > 0 || b.monto === null) return avisar("Falta elegir cuánto fue.");
  const descripcion = b.descripcion?.trim() ? `, ${b.descripcion.trim().replace(/[.。]+$/, "")}` : "";
  return { pregunta: "confirmar", texto: `Gasto de ${b.categoria}${descripcion}: ${solesHablados(b.monto)} ${MEDIOS_HABLADOS[b.medio]}. ¿Confirmo?` };
}

/** Lo que se va a guardar de una compra, dicho: a quién, las frutas a su costo y el total. */
function resumenCompra(b: BorradorCompra, total: number): string {
  const uno = b.items.length === 1;
  const items = b.items
    .map((it) => `${cajasHabladas(it.cantidad)} de ${nombreHablado(it.producto)}, a ${precioHablado(it.precio!)}${uno ? " la caja" : ""}${it.sugerido ? ", costo sugerido" : ""}`)
    .join(", y ");
  return `Compra${b.proveedor ? ` a ${b.proveedor.nombre}` : ""}: ${items}. Total, ${solesHablados(total)}.`;
}

/** «Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. La debes. ¿Confirmo?» */
export function guionCompra(b: BorradorCompra, dudas: string[]): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada("esta compra") };
  const falta = faltaCompra(b);
  const total = totalCompra(b);
  if (falta.length === 1 && falta[0] === "condicion" && total !== null) return { pregunta: "pago", texto: `${resumenCompra(b, total)} ¿La pagaste o la debes?` };
  if (falta.length > 0 || total === null) return avisar(frasesFaltaCompra(falta));
  const pago = b.condicion === "credito" ? "La debes" : `La pagaste ${MEDIOS_HABLADOS[b.medio ?? "efectivo"]}`;
  return { pregunta: "confirmar", texto: `${resumenCompra(b, total)} ${pago}. ¿Confirmo?` };
}
