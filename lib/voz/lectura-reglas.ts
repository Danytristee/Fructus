// Lo que Fructus dice en voz alta antes de guardar una venta en manos libres (ADR-0020, candado 1): lo que se va a guardar, no la
// transcripción. Es la misma tarjeta, dicha. Lógica pura: no importa React ni el sintetizador del navegador (components/voz/hablar.ts).
import { faltaDe, totalDe, type Borrador, type Medio } from "./confirmar-venta-reglas";

const MEDIOS: Record<Medio, string> = { efectivo: "en efectivo", yape: "con Yape", plin: "con Plin", transferencia: "por transferencia" };

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
function precioHablado(n: number): string {
  const centimos = Math.round(n * 100);
  return centimos % 100 === 0 ? String(centimos / 100) : `${Math.trunc(centimos / 100)} con ${String(centimos % 100).padStart(2, "0")}`;
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
  const uno = b.items.length === 1;
  // Con una sola fruta, «a 45 la caja»; con varias, solo «a 45» en cada una, o la lectura se hace eterna.
  const items = b.items
    .map((it) => `${cajasHabladas(it.cantidad)} de ${nombreHablado(it.producto)}, a ${precioHablado(it.precio!)}${uno ? " la caja" : ""}${it.sugerido ? ", precio sugerido" : ""}`)
    .join(", y ");
  const para = b.cliente ? `para ${b.cliente.nombre}` : "para un cliente de paso";
  const rebaja = b.descuento > 0 ? `, con ${solesHablados(b.descuento)} de rebaja` : "";
  const pago = b.condicion === "credito" ? "Lo debe" : `Pagó ${MEDIOS[b.medio ?? "efectivo"]}`;
  const comprobante = b.comprobante === "boleta" ? " Con boleta." : b.comprobante === "factura" ? " Con factura." : "";
  return `${items}, ${para}. Total, ${solesHablados(total)}${rebaja}. ${pago}.${comprobante} ¿Confirmo?`;
}
