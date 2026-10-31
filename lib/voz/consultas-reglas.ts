// Las respuestas a lo que se pregunta por voz (A7): lo que se ve en la hoja y lo que se dice en voz alta. Un veredicto
// primero («Te deben S/ 1,472.50»), el detalle después (ley 3). Lógica pura: los datos llegan de lib/voz/consultas.ts.
import { formatearSoles } from "../formato";
import type { Interpretacion } from "./esquemas";
import { numeroEnPalabras, solesEnPalabras } from "./palabras-reglas";

export type TipoConsulta = Extract<Interpretacion, { herramienta: "consultar" }>["datos"]["consulta"];

/** El título de la hoja según lo que se preguntó (también mientras la respuesta llega). */
export const TITULO_CONSULTA: Record<TipoConsulta, string> = {
  quien_me_debe: "Quién te debe",
  deuda_cliente: "Cuánto te debe",
  stock_producto: "Cuánto te queda",
  stock: "Tu stock",
  ventas_hoy: "Lo que vendiste hoy",
  gastos_hoy: "Lo que gastaste hoy",
  resumen_dia: "Tu día",
};

export type Respuesta = {
  /** El título de la hoja: «Quién te debe». */
  titulo: string;
  /** Lo que acompaña a la cifra: «Te deben». */
  etiqueta: string;
  /** La cifra protagonista; null si no hay nada que contar («Nadie te debe»). */
  cifra: { tipo: "soles"; valor: number; tono: "deuda" | "normal" | "exito" } | { tipo: "cajas"; valor: number } | null;
  /** Lo que se lee debajo de la cifra: «entre 6 clientes». */
  detalle: string | null;
  filas: { id: number; nombre: string; valor: string; tono?: "deuda" }[];
  /** Cuántos más hay fuera de la lista. */
  mas: number;
  /** A dónde ir para ver todo. */
  enlace: { texto: string; href: string } | null;
  /** Lo que se dice en voz alta: frases cortas, montos en palabras. */
  hablado: string;
};

/** Cuántos se nombran en la hoja: los que más deben. El resto vive en el cuaderno. */
const EN_LISTA = 5;

/** «¿Quién me debe?»: el total, entre cuántos, y los que más deben primero. */
export function respuestaQuienMeDebe(clientes: { id: number; nombre: string; saldo: number }[]): Respuesta {
  const deben = clientes.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const base = { titulo: TITULO_CONSULTA.quien_me_debe, enlace: { texto: "Ver todo el cuaderno", href: "/clientes" } };
  if (deben.length === 0) {
    return { ...base, etiqueta: "Nadie te debe", cifra: null, detalle: "Tu cuaderno está al día", filas: [], mas: 0, hablado: "Nadie te debe. Tu cuaderno está al día." };
  }
  const total = deben.reduce((s, c) => s + Math.round(c.saldo * 100), 0) / 100;
  const primero = deben[0]!;
  const solo = deben.length === 1;
  return {
    ...base,
    etiqueta: "Te deben",
    cifra: { tipo: "soles", valor: total, tono: "deuda" },
    detalle: solo ? `solo ${primero.nombre}` : `entre ${deben.length} clientes`,
    filas: deben.slice(0, EN_LISTA).map((c) => ({ id: c.id, nombre: c.nombre, valor: formatearSoles(c.saldo), tono: "deuda" })),
    mas: Math.max(0, deben.length - EN_LISTA),
    hablado: solo
      ? `Solo te debe ${primero.nombre}: ${solesEnPalabras(primero.saldo)}.`
      : `Te deben ${solesEnPalabras(total)}, entre ${numeroEnPalabras(deben.length)} clientes. El que más te debe es ${primero.nombre}, con ${solesEnPalabras(primero.saldo)}.`,
  };
}
