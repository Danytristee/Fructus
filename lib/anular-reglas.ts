// Anular una venta (A8): por qué se puede anular, qué se lee como motivo válido y qué pasa al anular, dicho antes de hacerlo
// (anular es lo irreversible: se confirma con sus consecuencias a la vista, ley 7). Lógica pura.
import { lineaDeFruta, type DetalleVenta } from "./ventas-reglas";

export const MOTIVOS_RAPIDOS = [
  { clave: "equivocacion", texto: "Me equivoqué al registrarla" },
  { clave: "doble", texto: "Se registró dos veces" },
  { clave: "devolucion", texto: "El cliente la devolvió" },
  { clave: "otro", texto: "Otro motivo" },
] as const;

export type ClaveMotivo = (typeof MOTIVOS_RAPIDOS)[number]["clave"];

/** Lo mismo que exige la base (`venta_anulada_con_motivo`): de 3 a 200 letras. */
const MOTIVO_MINIMO = 3;
const MOTIVO_MAXIMO = 200;

const espacios = (t: string) => t.replace(/\s+/g, " ").trim();

export type LecturaMotivo = { ok: true; motivo: string } | { ok: false; error: string | null };

/** El motivo que se guarda: el de la lista, o el que la persona escribió en «Otro motivo». Sin elegir no es un error: falta elegir. */
export function leerMotivo(clave: ClaveMotivo | null, escrito: string): LecturaMotivo {
  if (clave === null) return { ok: false, error: null };
  if (clave !== "otro") return { ok: true, motivo: MOTIVOS_RAPIDOS.find((m) => m.clave === clave)!.texto };
  const motivo = espacios(escrito);
  if (motivo === "") return { ok: false, error: null };
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, error: `Cuéntalo con ${MOTIVO_MINIMO} letras o más.` };
  if (motivo.length > MOTIVO_MAXIMO) return { ok: false, error: `El motivo no puede pasar de ${MOTIVO_MAXIMO} letras.` };
  return { ok: true, motivo };
}

/** Lo que el servidor guarda como motivo: sin espacios de más. null si no sirve (la base lo rechazaría). */
export function motivoLimpio(texto: string): string | null {
  const motivo = espacios(texto);
  return motivo.length >= MOTIVO_MINIMO && motivo.length <= MOTIVO_MAXIMO ? motivo : null;
}

/** Qué pasa al anular, en frases de puesto: la fruta vuelve al stock y la deuda o lo vendido baja. */
export function consecuenciasDeAnular(v: Pick<DetalleVenta, "total" | "condicion" | "cliente" | "items" | "pagoAlLlevar">, soles: (n: number) => string): string[] {
  const fruta = v.items.slice(0, 2).map((i) => lineaDeFruta(i, soles).titulo);
  const resto = v.items.length - fruta.length;
  const quedan = fruta.join(" y ") + (resto > 0 ? ` y ${resto} más` : "");
  const frases = [`Vuelven al stock ${quedan}.`];
  // Lo que pagó al llevar no se anula (ADR-0023, opción A): queda a su favor, y se dice antes de confirmar (/chaos 2026-11-17).
  const aFavor = v.pagoAlLlevar ? `: los ${soles(v.pagoAlLlevar.monto)} que pagó al llevar le quedan a favor` : "";
  if (v.condicion === "credito" && v.cliente) frases.push(`${v.cliente.nombre} te debe ${soles(v.total)} menos${aFavor}.`);
  else frases.push(`Se descuentan ${soles(v.total)} de lo que vendiste.`);
  return frases;
}
