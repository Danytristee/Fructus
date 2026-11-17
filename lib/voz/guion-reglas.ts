// Lo que Fructus dice en manos libres al abrir la tarjeta de un abono, una merma, un gasto o una compra (ADR-0020): la misma idea que
// la venta (lib/voz/lectura-reglas.ts). Se lee lo que se va a guardar y se pregunta «¿Confirmo?»; si falta saber si la compra se pagó,
// se pregunta primero. En el abono y la compra, lo que falta (quién, cuánto, la fruta, el costo) se dice y se pregunta, y la respuesta
// completa la tarjeta (ADR-0027). Con dudas o si falta otro dato, solo se avisa y se confirma con el dedo. Lógica pura.
import { faltaAbono, frasesFaltaAbono, type BorradorAbono } from "./confirmar-abono-reglas";
import { faltaCompra, frasesFaltaCompra, totalCompra, type BorradorCompra } from "./confirmar-compra-reglas";
import { faltaGasto, type BorradorGasto } from "./confirmar-gasto-reglas";
import { faltaMerma, frasesFaltaMerma, type BorradorMerma } from "./confirmar-merma-reglas";
import { MEDIOS_HABLADOS, cajasHabladas, nombreHablado, precioHablado, solesHablados } from "./hablado-reglas";
import { dudaHablada, type Guion, type Relectura } from "./lectura-reglas";
import {
  faltaDicha,
  faltaPorPreguntarAbono,
  faltaPorPreguntarCompra,
  preguntaFaltaAbono,
  preguntaFaltaCompra,
  type OpcionesAbono,
  type OpcionesCompra,
} from "./pregunta-falta-reglas";

const avisar = (falta: string | null): Guion => ({ pregunta: "ninguna", texto: `${falta ?? "Falta un dato."} Míralo en la tarjeta.` });

const sinNombres = { dicho: null, opciones: [] };
const SIN_OPCIONES_ABONO: OpcionesAbono = { cliente: sinNombres };
const SIN_OPCIONES_COMPRA: OpcionesCompra = { proveedor: sinNombres, productos: [] };

/** Lo que falta dicho y la pregunta por lo primero: «Falta el cliente. ¿Quién te pagó? ¿Luis Paredes o Luis Pérez?». */
const preguntar = (falta: string, pregunta: string, condicion?: string): Guion => ({
  pregunta: "falta",
  texto: `${faltaDicha(falta.split(","), { condicion })} ${pregunta}`,
  repregunta: pregunta,
});

/** «Abono de Luis Paredes: 200 soles con Yape. ¿Confirmo?». Si falta quién o cuánto, lo pregunta (ADR-0027). */
export function guionAbono(b: BorradorAbono, dudas: string[], opciones: OpcionesAbono = SIN_OPCIONES_ABONO): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada(dudas) };
  const falta = faltaAbono(b);
  const f = faltaPorPreguntarAbono(b, opciones);
  if (f) return preguntar(falta.join(), preguntaFaltaAbono(b, f, opciones));
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

/**
 * «Compra a Agrícola Chao: 50 cajas de Plátano Isla, a 25 la caja. Total, 1250 soles. La debes. ¿Confirmo?». Si falta la fruta, las
 * cajas, el costo o a quién se le debe, lo pregunta (ADR-0027).
 */
export function guionCompra(b: BorradorCompra, dudas: string[], opciones: OpcionesCompra = SIN_OPCIONES_COMPRA): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada(dudas) };
  const falta = faltaCompra(b);
  const total = totalCompra(b);
  if (falta.length === 1 && falta[0] === "condicion" && total !== null) return { pregunta: "pago", texto: `${resumenCompra(b, total)} ¿La pagaste o la debes?` };
  const f = faltaPorPreguntarCompra(b, opciones);
  if (f) return preguntar(falta.join(), preguntaFaltaCompra(b, f, opciones), "si la pagaste");
  if (falta.length > 0 || total === null) return avisar(frasesFaltaCompra(falta));
  return { pregunta: "confirmar", texto: `${resumenCompra(b, total)} ${cierreCompra(b)}` };
}

const cierreCompra = (b: BorradorCompra) => `${b.condicion === "credito" ? "La debes" : `La pagaste ${MEDIOS_HABLADOS[b.medio ?? "efectivo"]}`}. ¿Confirmo?`;

/**
 * Después de responder «¿La pagaste o la debes?»: «La debes. ¿Confirmo?», sin volver a leer la compra (como relecturaPago). Si la
 * debes y no se sabe a quién: «La debes. ¿A quién se la compraste?». null si falta algo que se elige en la tarjeta.
 */
export function relecturaPagoCompra(b: BorradorCompra, dudas: string[], opciones: OpcionesCompra = SIN_OPCIONES_COMPRA): Relectura | null {
  const g = guionCompra(b, dudas, opciones);
  if (g.pregunta === "confirmar") return { pregunta: "confirmar", texto: cierreCompra(b), entera: g.texto };
  if (g.pregunta !== "falta" || !g.repregunta) return null;
  return { ...g, texto: `${cierreCompra(b).replace(" ¿Confirmo?", "")} ${g.repregunta}`, entera: g.texto };
}

/**
 * Qué se dice después de que la persona respondió lo que faltaba (`pregunta` «falta») o corrigió el abono o la compra («no, fueron
 * 300»). Son cortos: se leen enteros.
 *   - Respondió lo que faltaba: «Anotado.» y la pregunta siguiente, o la operación entera si ya está completa (nunca se leyó entera).
 *     Si no cambió nada, `sinCambio`: no se entendió y se repregunta.
 *   - Corrigió: «Corregido.» y la operación entera, o lo que ahora falta.
 *   - Con dudas o si falta algo que se elige en la tarjeta, el aviso de siempre.
 */
function despuesDeResponder(g: Guion, cambio: boolean, pregunta: string): Relectura {
  if (g.pregunta === "ninguna") return { ...g, entera: g.texto };
  if (pregunta !== "falta") return { ...g, texto: `Corregido. ${g.texto}`, entera: g.texto };
  if (!cambio) return { ...g, entera: g.texto, sinCambio: true };
  return { ...g, texto: `Anotado. ${g.pregunta === "falta" ? g.repregunta : g.texto}`, entera: g.texto };
}
const distintos = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function guionAbonoRespondido(antes: BorradorAbono, despues: BorradorAbono, dudas: string[], opciones: OpcionesAbono, pregunta: string): Relectura {
  return despuesDeResponder(guionAbono(despues, dudas, opciones), distintos(antes, despues), pregunta);
}

export function guionCompraRespondida(antes: BorradorCompra, despues: BorradorCompra, dudas: string[], opciones: OpcionesCompra, pregunta: string): Relectura {
  return despuesDeResponder(guionCompra(despues, dudas, opciones), distintos(antes, despues), pregunta);
}
