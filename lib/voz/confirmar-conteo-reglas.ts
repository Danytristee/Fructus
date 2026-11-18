// El conteo físico (ADR-0028): de la tarjeta (lo que se dictó o se abrió a mano) al borrador que la persona ajusta, y del borrador a
// lo que recibe registrar_conteo. Se anota lo CONTADO; la diferencia con la app la recalcula la base al guardar. Lógica pura.
import { formatearCajas } from "../formato";
import type { Tarjeta } from "./tarjeta-reglas";

type Conteo = Extract<Tarjeta, { tipo: "conteo" }>;

export const CAUSAS_CONTEO = ["se_malogro", "venta_sin_anotar", "compra_sin_anotar", "no_se"] as const;
export type CausaConteo = (typeof CAUSAS_CONTEO)[number];

/** Más cajas de una fruta que esto no caben en un puesto: es un error al contar o al dictar. */
export const CONTEO_MAXIMO = 2000;

export type BorradorConteo = {
  producto: { id: number; nombre: string } | null;
  /** Lo contado. null: todavía no se sabe (a mano, hasta leer lo que dice la app; el contador arranca ahí). */
  contado: number | null;
  causa: CausaConteo | null;
};

export function borradorConteo(t: Conteo): BorradorConteo {
  return { producto: t.producto.elegido, contado: t.contado, causa: t.causa };
}

const centimos = (n: number) => Math.round(n * 100);

/** Contado menos lo que dice la app, sin errores de coma. */
export function diferenciaConteo(contado: number, stock: number): number {
  return (centimos(contado) - centimos(stock)) / 100;
}

/** Dónde arranca el contador a mano: en lo que dice la app (si cuadra, cero toques), nunca debajo de cero. */
export function inicioContador(stock: number): number {
  return Math.max(0, Math.round(stock * 100) / 100);
}

/** Las causas que pueden explicar esa diferencia, en el orden en que se ofrecen. Lo malogrado y lo vendido faltan; lo comprado sobra. */
export function causasPara(diferencia: number): { valor: CausaConteo; etiqueta: string }[] {
  if (diferencia < 0) {
    return [
      { valor: "se_malogro", etiqueta: "Se malogró" },
      { valor: "venta_sin_anotar", etiqueta: "Se vendió sin anotar" },
      { valor: "no_se", etiqueta: "No sé" },
    ];
  }
  if (diferencia > 0) {
    return [
      { valor: "compra_sin_anotar", etiqueta: "Llegó sin anotar" },
      { valor: "no_se", etiqueta: "No sé" },
    ];
  }
  return [];
}

/** La causa elegida sigue explicando la diferencia (si cambió el número contado, puede que ya no). */
export function causaVale(causa: CausaConteo | null, diferencia: number): boolean {
  return causa !== null && causasPara(diferencia).some((c) => c.valor === causa);
}

export type FaltaConteo = "producto" | "stock" | "causa";

/** Qué falta para poder confirmar. Sin saber qué dice la app no se puede comparar: el conteo necesita señal. */
export function faltaConteo(b: BorradorConteo, stock: number | null): FaltaConteo[] {
  if (!b.producto) return ["producto"];
  if (stock === null || b.contado === null) return ["stock"];
  const dif = diferenciaConteo(b.contado, stock);
  return dif !== 0 && !causaVale(b.causa, dif) ? ["causa"] : [];
}

export function frasesFaltaConteo(falta: FaltaConteo[], diferencia: number | null): string | null {
  if (falta.includes("producto")) return "Elige qué fruta contaste.";
  if (falta.includes("stock")) return "Para contar necesitas señal: así se compara con lo que dice la app.";
  if (falta.includes("causa")) return diferencia !== null && diferencia > 0 ? "Elige por qué sobran." : "Elige por qué faltan.";
  return null;
}

export type Veredicto = { tipo: "cuadra" | "faltan" | "sobran"; cajas: number; texto: string };

/** «Cuadra con la app», «Faltan 2 cajas», «Sobran 4 cajas»: la diferencia dicha como veredicto (ley 3). */
export function veredictoConteo(contado: number, stock: number): Veredicto {
  const dif = diferenciaConteo(contado, stock);
  if (dif === 0) return { tipo: "cuadra", cajas: 0, texto: "Cuadra con la app" };
  const cajas = Math.abs(dif);
  const verbo = dif < 0 ? (cajas === 1 ? "Falta" : "Faltan") : cajas === 1 ? "Sobra" : "Sobran";
  return { tipo: dif < 0 ? "faltan" : "sobran", cajas, texto: `${verbo} ${formatearCajas(cajas)}` };
}

/** Lo que la app decía, sin cifras imposibles: con stock negativo, «no tenía ninguna». */
export function segunLaApp(stock: number): string {
  return stock > 0 ? `La app decía ${formatearCajas(stock)}.` : "La app no tenía ninguna caja.";
}

/** Si la causa es «se malogró», la diferencia se anota como merma (decisión del 2026-11-17). */
export function efectoDeCausa(causa: CausaConteo | null): string | null {
  if (causa === "se_malogro") return "Se anota como merma.";
  if (causa === "compra_sin_anotar") return "Entran al stock. La compra, con su precio, anótala aparte si la tienes.";
  return null;
}

/**
 * Sin causa, el campo no va (la RPC la toma como null). `p_segun_app`: lo que decía la app cuando la persona comparó; si al guardar
 * es otro número (entró una venta o una compra mientras contaba), la base rechaza y la pantalla vuelve a comparar.
 */
export type PedidoConteo = { p_producto_id: number; p_contado: number; p_causa?: CausaConteo; p_comando_voz_id: number; p_segun_app: number };

/** Lo que va a registrar_conteo. null si falta algo. La causa va aunque cuadre: la base la ignora si al guardar cuadra. */
export function pedidoConteo(b: BorradorConteo, comandoId: number, segunApp: number): PedidoConteo | null {
  if (!b.producto || b.contado === null || b.contado < 0 || b.contado > CONTEO_MAXIMO) return null;
  return { p_producto_id: b.producto.id, p_contado: b.contado, ...(b.causa ? { p_causa: b.causa } : {}), p_comando_voz_id: comandoId, p_segun_app: segunApp };
}

/** Se corrigió lo dictado (para `comandos_voz`): otra fruta, otro número u otra causa. A mano no hay qué corregir. */
export function fueCorregidoConteo(t: Conteo, b: BorradorConteo): boolean {
  return (t.producto.elegido?.id ?? null) !== (b.producto?.id ?? null) || t.contado !== b.contado || t.causa !== b.causa;
}
