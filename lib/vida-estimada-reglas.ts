// Cuánto aguanta cada fruta, estimado por la IA en vez de leído de una tabla fija (ADR-0021). Lógica pura: no importa React,
// Supabase ni el SDK de Anthropic.
//
// El problema: la tabla dice «manzana, 30 días» para la Fuji y para la Delicia, y «plátano, 6» para el de seda y para el
// bellaco. Es como pesar todas las cajas con la misma tara: sirve de arranque, pero a unas les avisa tarde y a otras antes.
// Cómo se resuelve: una vez al día se le pregunta al modelo por las frutas que todavía no tienen estimación. Lo que contesta
// se guarda con su motivo, y Stock cuenta con eso en vez de la tabla.
// Mal hecho: creerle cualquier número («el mango aguanta 40 días» apagaría el aviso justo cuando hace falta), o volver a
// preguntarle cada noche lo que ya contestó (la respuesta baila de un día a otro y el aviso baila con ella).
import { z } from "zod";

import type { PartesProducto } from "./productos-reglas";
import { vidaUtilDias } from "./vida-util-reglas";

/** Lo que se le manda al modelo por cada fruta: su número, cómo se llama y cuántos días le da hoy la tabla. */
export type FrutaPorEstimar = { id: number; fruta: string; tabla: number };

/** La estimación que rige para una fruta: días que aguanta a temperatura normal si llega pintona, por qué, y de qué día es. */
export type VidaEstimada = { dias: number; motivo: string; dia: string };

/** Cuántas frutas se le preguntan en una noche. El catálogo del puesto tiene unas 60: lo que no entre, entra la siguiente. */
export const TOPE_POR_NOCHE = 60;
/** Cuánto puede alejarse la estimación de lo que dice la tabla: la mitad, para arriba o para abajo. */
const MARGEN = 0.5;
const MOTIVO_MAXIMO = 160;

const unir = (partes: (string | null | undefined | false)[], separador: string) => partes.filter(Boolean).join(separador);

/** El nombre con todo lo que cambia cuánto aguanta: «Manzana Roja americana Premium, calibre 113, caja de 18 kg». */
const nombreParaElModelo = (p: PartesProducto): string =>
  unir([unir([p.nombre, p.variedad, p.seleccion], " "), p.marca && `marca ${p.marca}`, p.calibre && `calibre ${p.calibre}`, p.kgPorCaja != null && p.kgPorCaja > 0 && `caja de ${p.kgPorCaja} kg`], ", ");

/**
 * A qué frutas hay que estimarles la vida esta noche: las que todavía no tienen ninguna estimación. Primero las que tienen
 * cajas en el puesto, que son las que mueven el aviso de mañana. Lo que ya se estimó no se vuelve a preguntar.
 */
export function frutasPorEstimar(productos: readonly (PartesProducto & { id: number; stock: number })[], yaEstimadas: ReadonlySet<number>): FrutaPorEstimar[] {
  return productos
    .filter((p) => !yaEstimadas.has(p.id))
    .map((p, orden) => ({ p, orden }))
    .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || a.orden - b.orden)
    .slice(0, TOPE_POR_NOCHE)
    .map(({ p }) => ({ id: p.id, fruta: nombreParaElModelo(p), tabla: vidaUtilDias(p.nombre) }));
}

/** Entre cuántos días puede caer la estimación de una fruta, según lo que dice la tabla. Nunca menos de un día. */
export function limitesDe(tabla: number): { minimo: number; maximo: number } {
  return { minimo: Math.max(1, Math.ceil(tabla * (1 - MARGEN))), maximo: Math.max(1, Math.floor(tabla * (1 + MARGEN))) };
}

/** La forma de la respuesta del modelo. Los topes no van aquí: se aplican después, fruta por fruta (aceptarEstimaciones). */
export const RespuestaDelModelo = z.object({
  estimaciones: z.array(
    z.object({
      producto_id: z.number().describe("El id de la fruta, tal como llegó en el pedido."),
      dias: z.number().describe("Días enteros que aguanta una caja en buen estado a 24 °C, si llegó pintona."),
      motivo: z.string().describe("Una frase corta que el dueño del puesto entienda. Sin números de días."),
    }),
  ),
});
export type RespuestaDelModelo = z.infer<typeof RespuestaDelModelo>;

export type EstimacionAceptada = { productoId: number; dias: number; motivo: string; recortada: boolean };

const enUnaLinea = (texto: string): string => {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= MOTIVO_MAXIMO ? limpio : `${limpio.slice(0, MOTIVO_MAXIMO - 1).trimEnd()}…`;
};

/**
 * Lo que se guarda de lo que contestó el modelo. Solo las frutas que se le pidieron y una vez cada una; en días enteros; dentro
 * del margen de la tabla (`recortada` dice si hubo que meterla al margen); y con su motivo. Lo que no cumple se descarta y esa
 * fruta sigue con la tabla: una estimación a medias no vale más que ninguna.
 */
export function aceptarEstimaciones(pedidas: readonly FrutaPorEstimar[], respuesta: RespuestaDelModelo): EstimacionAceptada[] {
  const tablaDe = new Map(pedidas.map((f) => [f.id, f.tabla]));
  const vistas = new Set<number>();
  const aceptadas: EstimacionAceptada[] = [];
  for (const e of respuesta.estimaciones) {
    const tabla = tablaDe.get(e.producto_id);
    if (tabla === undefined || vistas.has(e.producto_id)) continue;
    vistas.add(e.producto_id);
    const motivo = enUnaLinea(e.motivo);
    if (!Number.isFinite(e.dias) || e.dias <= 0 || motivo === "") continue;
    const { minimo, maximo } = limitesDe(tabla);
    const propuesta = Math.round(e.dias);
    const dias = Math.min(maximo, Math.max(minimo, propuesta));
    aceptadas.push({ productoId: e.producto_id, dias, motivo, recortada: dias !== propuesta });
  }
  return aceptadas;
}
