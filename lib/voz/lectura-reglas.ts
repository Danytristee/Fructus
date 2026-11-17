// Lo que Fructus dice en voz alta antes de guardar una venta en manos libres (ADR-0020, candado 1): lo que se va a guardar, no la
// transcripción. Es la misma tarjeta, dicha. Lógica pura: no importa React ni el sintetizador del navegador (components/voz/hablar.ts).
import { debeDe, faltaDe, frasesFalta, totalDe, type Borrador, type Medio } from "./confirmar-venta-reglas";

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

/** Lo que se va a guardar, dicho: las frutas, el cliente, el total y la rebaja. Sin el pago ni la pregunta del final. */
function resumenHablado(b: Borrador, total: number): string {
  const uno = b.items.length === 1;
  // Con una sola fruta, «a 45 la caja»; con varias, solo «a 45» en cada una, o la lectura se hace eterna.
  const items = b.items
    .map((it) => `${cajasHabladas(it.cantidad)} de ${nombreHablado(it.producto)}, a ${precioHablado(it.precio!)}${uno ? " la caja" : ""}${it.sugerido ? ", precio sugerido" : ""}`)
    .join(", y ");
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
  const medio = MEDIOS_HABLADOS[b.medio ?? "efectivo"];
  // Lo que pagó al llevar se dice con su medio y con lo que queda: «Pagó 1000 soles con Yape y debe 4000 soles» (ADR-0023).
  const pago =
    b.condicion !== "credito" ? `Pagó ${medio}` : b.pagado ? `Pagó ${solesHablados(b.pagado)} ${medio} y debe ${solesHablados(debeDe(b) ?? 0)}` : "Lo debe";
  const comprobante = b.comprobante === "boleta" ? " Con boleta." : b.comprobante === "factura" ? " Con factura." : "";
  return `${resumenHablado(b, total)} ${pago}.${comprobante} ¿Confirmo?`;
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
