// Cómo se dicen en voz alta los nombres, las cajas y los soles (manos libres, ADR-0020): «10 cajas», «45 con 50», «calibre 113».
// Lo usan la lectura de la venta (lectura-reglas.ts), las de las otras operaciones (guion-reglas.ts) y las preguntas por lo que
// falta (pregunta-falta-reglas.ts). Lógica pura.
import type { Medio } from "./confirmar-venta-reglas";

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
