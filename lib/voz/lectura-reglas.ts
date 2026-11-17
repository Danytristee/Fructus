// Lo que Fructus dice en voz alta antes de guardar una venta en manos libres (ADR-0020, candado 1): lo que se va a guardar, no la
// transcripción. Es la misma tarjeta, dicha. Lógica pura: no importa React ni el sintetizador del navegador (components/voz/hablar.ts).
import { faltaDe, frasesFalta, totalDe, type Borrador, type ItemBorrador, type Medio } from "./confirmar-venta-reglas";

/** Cómo se dice cómo se pagó: «en efectivo», «con Yape». */
export const MEDIOS_HABLADOS: Record<Medio, string> = { efectivo: "en efectivo", yape: "con Yape", plin: "con Plin", transferencia: "por transferencia" };

// «6ta» o «cal. 113» se leen mal en voz alta: se dicen como se hablan.
const ORDINALES: [RegExp, string][] = [
  [/\b1e?ra\b/gi, "primera"],
  [/\b2da\b/gi, "segunda"],
  [/\b3ra\b/gi, "tercera"],
  [/\b4ta\b/gi, "cuarta"],
  [/\b5ta\b/gi, "quinta"],
  [/\b6ta\b/gi, "sexta"],
];

/** El nombre de la fruta como se dice: «cal. 113» es «calibre 113» y «6ta» es «sexta». */
export function nombreHablado(nombre: string): string {
  let s = nombre.replace(/\bcal\.\s*/gi, "calibre ");
  for (const [patron, palabra] of ORDINALES) s = s.replace(patron, palabra);
  return s.replace(/\s+/g, " ").trim();
}

/** Cajas como se dicen: «10 cajas», «1 caja», «media caja», «2 cajas y media». */
export function cajasHabladas(n: number): string {
  const entero = Math.trunc(n);
  if (n === entero) return `${n} ${n === 1 ? "caja" : "cajas"}`;
  if (n - entero === 0.5) return entero === 0 ? "media caja" : `${entero} ${entero === 1 ? "caja" : "cajas"} y media`;
  return `${n.toLocaleString("es-PE", { maximumFractionDigits: 2 })} cajas`;
}

/**
 * Soles como se dicen: «450 soles», «1 sol», «45 soles con 50». Sin separador de miles: «1,250» se lee «uno coma doscientos
 * cincuenta», y «1250», «mil doscientos cincuenta».
 */
export function solesHablados(n: number): string {
  const centimos = Math.round(n * 100);
  const entero = Math.trunc(centimos / 100);
  const resto = centimos % 100;
  const soles = `${entero} ${entero === 1 ? "sol" : "soles"}`;
  return resto === 0 ? soles : `${soles} con ${String(resto).padStart(2, "0")}`;
}

/** Un precio por caja, corto: «45», «45 con 50». */
export function precioHablado(n: number): string {
  const centimos = Math.round(n * 100);
  return centimos % 100 === 0 ? String(centimos / 100) : `${Math.trunc(centimos / 100)} con ${String(centimos % 100).padStart(2, "0")}`;
}

/** Una fruta de la venta, dicha. Con una sola fruta, «a 45 la caja»; con varias, solo «a 45» en cada una, o la lectura se hace eterna. */
const itemHablado = (it: ItemBorrador, uno: boolean) =>
  `${cajasHabladas(it.cantidad)} de ${nombreHablado(it.producto)}, a ${precioHablado(it.precio!)}${uno ? " la caja" : ""}${it.sugerido ? ", precio sugerido" : ""}`;

/** Lo que se va a guardar, dicho: las frutas, el cliente, el total y la rebaja. Sin el pago ni la pregunta del final. */
function resumenHablado(b: Borrador, total: number): string {
  const uno = b.items.length === 1;
  const items = b.items.map((it) => itemHablado(it, uno)).join(", y ");
  const para = b.cliente ? `para ${b.cliente.nombre}` : "para un cliente de paso";
  const rebaja = b.descuento > 0 ? `, con ${solesHablados(b.descuento)} de rebaja` : "";
  return `${items}, ${para}. Total, ${solesHablados(total)}${rebaja}.`;
}

/**
 * La lectura de una venta lista para guardar. null si todavía falta algo (cliente, fruta, precio, si pagó): lo incompleto no se lee,
 * se pide.
 *
 * «10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?»
 */
export function lecturaVenta(b: Borrador): string | null {
  const total = totalDe(b);
  if (faltaDe(b).length > 0 || total === null) return null;
  return `${resumenHablado(b, total)} ${cierreVenta(b)}`;
}

/** El final de la lectura: cómo pagó, el comprobante si se pidió y la pregunta. «Lo debe. Con boleta. ¿Confirmo?» */
function cierreVenta(b: Borrador): string {
  const pago = b.condicion === "credito" ? "Lo debe" : `Pagó ${MEDIOS_HABLADOS[b.medio ?? "efectivo"]}`;
  const comprobante = b.comprobante === "boleta" ? " Con boleta." : b.comprobante === "factura" ? " Con factura." : "";
  return `${pago}.${comprobante} ¿Confirmo?`;
}

/**
 * Lo que se dice después de responder «¿Pagó o lo debe?», y la lectura entera para «repite». La venta se acaba de leer al
 * preguntar: leerla otra vez hacía esperar toda la lectura por una palabra. Basta repetir la respuesta (ADR-0020, candado 4) con lo
 * que todavía no se dijo (el comprobante) y preguntar.
 */
export type Relectura = { texto: string; entera: string };

/** «Lo debe. ¿Confirmo?». null si todavía falta algo. */
export function relecturaPago(b: Borrador): Relectura | null {
  const entera = lecturaVenta(b);
  return entera === null ? null : { texto: cierreVenta(b), entera };
}

/** Lo que se dice tras una corrección hablada, y la venta entera para «repite». */
export type GuionCorregido = Guion & { entera: string };

const mismoItem = (a: ItemBorrador, b: ItemBorrador) =>
  a.productoId === b.productoId && a.producto === b.producto && a.cantidad === b.cantidad && a.precio === b.precio && a.sugerido === b.sugerido;

/**
 * Qué dice Fructus cuando la persona corrige hablando («no, son ocho cajas»): solo lo que cambió, no la venta entera, que se acaba
 * de leer. «Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles. ¿Confirmo?»
 *   - Se dicen las frutas que cambiaron (con sus cajas y su precio), el cliente, la rebaja, el pago y el comprobante, si cambiaron.
 *   - El total se dice siempre que cambie una fruta, la rebaja o el propio total: es el dinero que se va a confirmar.
 *   - Si cambió el número de frutas, se dicen todas: comparar una por una ya no dice nada.
 *   - Con dudas o si falta un dato, igual que al dictar (guionVenta): se mira la tarjeta. Si no cambió nada que se pueda nombrar, se
 *     lee la venta entera: lo que dijo la persona no se reflejó en nada y tiene que oír qué quedó.
 */
export function guionCorreccion(antes: Borrador, despues: Borrador, dudas: string[]): GuionCorregido {
  const completo = guionVenta(despues, dudas);
  const total = totalDe(despues);
  if (completo.pregunta === "ninguna" || total === null) return { ...completo, entera: completo.texto };

  const uno = despues.items.length === 1;
  const mismasFilas = antes.items.length === despues.items.length;
  const frutas = mismasFilas ? despues.items.filter((it, n) => !mismoItem(antes.items[n]!, it)) : despues.items;
  const rebaja = antes.descuento !== despues.descuento;
  const cambios: string[] = [];
  if (frutas.length > 0) cambios.push(`${frutas.map((it) => itemHablado(it, uno)).join(", y ")}.`);
  if ((antes.cliente?.id ?? null) !== (despues.cliente?.id ?? null)) cambios.push(despues.cliente ? `Para ${despues.cliente.nombre}.` : "Para un cliente de paso.");
  if (rebaja) cambios.push(despues.descuento > 0 ? `Con ${solesHablados(despues.descuento)} de rebaja.` : "Sin rebaja.");
  if (frutas.length > 0 || rebaja || totalDe(antes) !== total) cambios.push(`Total, ${solesHablados(total)}.`);
  if (despues.condicion !== null && (antes.condicion !== despues.condicion || (despues.condicion === "contado" && antes.medio !== despues.medio))) {
    cambios.push(despues.condicion === "credito" ? "Lo debe." : `Pagó ${MEDIOS_HABLADOS[despues.medio ?? "efectivo"]}.`);
  }
  if (antes.comprobante !== despues.comprobante) {
    cambios.push(despues.comprobante === "boleta" ? "Con boleta." : despues.comprobante === "factura" ? "Con factura." : "Sin comprobante.");
  }
  if (cambios.length === 0) return { ...completo, entera: completo.texto };
  const pregunta = completo.pregunta === "pago" ? "¿Pagó o lo debe?" : "¿Confirmo?";
  return { pregunta: completo.pregunta, texto: `Corregido. ${cambios.join(" ")} ${pregunta}`, entera: completo.texto };
}

/** Lo que pregunta, y qué espera oír: «confirmo», «pagó» o «lo debe», o nada (solo avisa y pide el toque). */
export type Guion = { pregunta: "confirmar" | "pago" | "ninguna"; texto: string };

/**
 * Con dudas del intérprete no se confirma hablando, pero la duda se dice: «Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la
 * tarjeta y toca Confirmar.» Solo «tengo una duda» obligaba a soltar las cajas para saber cuál (/formidable 2026-11-16). Con varias,
 * la primera y cuántas más.
 */
export function dudaHablada(dudas: string[]): string {
  const primera = (dudas[0] ?? "").trim().replace(/[.。]+$/, "");
  const duda = primera ? `: ${primera.charAt(0).toLowerCase()}${primera.slice(1)}` : "";
  const mas = dudas.length === 2 ? ", y una más" : dudas.length > 2 ? `, y ${dudas.length - 1} más` : "";
  const frase = `Tengo una duda${duda}${mas}`;
  // Una duda que es pregunta ya cierra con «?»: sin otro punto detrás.
  return `${frase}${/[?!]$/.test(frase) ? "" : "."} Revisa la tarjeta y toca Confirmar.`;
}

/**
 * Qué dice Fructus al abrir la tarjeta en manos libres (ADR-0020, candado 4):
 *   - con dudas del intérprete, no se confirma hablando: lo dice y pide el toque;
 *   - si solo falta saber si pagó, lo lee y pregunta «¿Pagó o lo debe?» (nunca se asume contado);
 *   - si falta otra cosa (el precio, la fruta), dice qué falta: se elige en la tarjeta;
 *   - si no falta nada, lee lo que se va a guardar y pregunta «¿Confirmo?».
 */
export function guionVenta(b: Borrador, dudas: string[]): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada(dudas) };
  const falta = faltaDe(b);
  const total = totalDe(b);
  if (falta.length === 0 && total !== null) return { pregunta: "confirmar", texto: lecturaVenta(b)! };
  if (falta.length === 1 && falta[0] === "condicion" && total !== null) return { pregunta: "pago", texto: `${resumenHablado(b, total)} ¿Pagó o lo debe?` };
  return { pregunta: "ninguna", texto: `${frasesFalta(falta)} Míralo en la tarjeta.` };
}
