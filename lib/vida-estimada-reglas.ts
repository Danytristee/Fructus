// Cuánto aguanta cada fruta, estimado por la IA en vez de leído de una tabla fija (ADR-0021). Lógica pura: no importa React,
// Supabase ni el SDK de Anthropic.
//
// El problema: la tabla dice «manzana, 30 días» para la Fuji y para la Delicia, y «plátano, 6» para el de seda y para el
// bellaco. Es como pesar todas las cajas con la misma tara: sirve de arranque, pero a unas les avisa tarde y a otras antes.
// Cómo se resuelve: una vez al día se le pregunta al modelo por las frutas que todavía no tienen estimación. Lo que contesta
// se guarda con su motivo, y Stock cuenta con eso en vez de la tabla.
// Mal hecho: creerle cualquier número («el mango aguanta 40 días» apagaría el aviso justo cuando hace falta), o volver a
// preguntarle cada noche lo que ya contestó (la respuesta baila de un día a otro y el aviso baila con ella).
//
// Se corrige sola: lo que pasa en el puesto es evidencia. Una merma dice «esta llegada se malogró cuando iba por el 60 % de la
// vida que le calculé»; un «Sigue buena», «esta seguía vendible con 40 % más». Cuando una fruta junta evidencia nueva, la
// noche siguiente vuelve al pedido con ella, y el modelo propone un ajuste. Cada ajuste va acotado (un paso por noche, y
// siempre dentro del margen de la tabla) y explicado (su motivo queda guardado y se ve en la hoja «¿por qué?»).
// Mal hecho: que una sola caja golpeada le quite tres días a todas las manzanas de un día para otro.
import { z } from "zod";

import { diaDeLima } from "./formato";
import { diasEntre, gastadoAl, llegadasEnStock, type Revision } from "./frescura-reglas";
import type { PartesProducto } from "./productos-reglas";
import type { TemperaturaDia } from "./temperatura-reglas";
import { vidaDeLlegada, vidaUtilDias, type EstadoLlegada } from "./vida-util-reglas";

/**
 * Lo que pasó con una llegada de esa fruta. `gastado` es qué parte de la vida que hoy se le calcula llevaba gastada cuando pasó
 * (con el calor de cada día y cómo llegó ya contados): una merma con 0.6 se malogró antes de tiempo; un «Sigue buena» con 1.4
 * aguantó más de lo calculado.
 */
export type Evidencia = { tipo: "merma"; haceDias: number; cajas: number; gastado: number } | { tipo: "sigue_buena"; haceDias: number; gastado: number };

/**
 * Lo que se le manda al modelo por cada fruta: su número, cómo se llama, cuántos días le da la tabla y entre cuántos puede caer
 * su respuesta. Si ya tenía estimación y hay evidencia nueva, también lo que rige (`actual`) y la evidencia.
 */
export type FrutaPorEstimar = { id: number; fruta: string; tabla: number; minimo: number; maximo: number; actual?: number; evidencia?: Evidencia[] };

/** La estimación que rige para una fruta: días que aguanta a temperatura normal si llega pintona, por qué, y de qué día es. */
export type VidaEstimada = { dias: number; motivo: string; dia: string };
/** La misma, con el momento exacto en que se guardó: lo que pasó después es evidencia nueva. */
export type VidaVigente = VidaEstimada & { creadoEn: string };

/** Lo que pasó en el puesto en las últimas semanas, tal como sale de la base, para armar la evidencia de cada fruta. */
export type Hechos = {
  /** Cada merma, con las cajas que había de esa fruta justo antes (`v_mermas_con_stock`). */
  mermas: readonly { productoId: number; fecha: string; cajas: number; stockAntes: number }[];
  revisiones: readonly (Revision & { productoId: number; creadoEn: string })[];
  entradas: readonly { productoId: number; fecha: string; cantidad: number; estado: EstadoLlegada | null }[];
  lecturas: readonly TemperaturaDia[];
};
export const SIN_HECHOS: Hechos = { mermas: [], revisiones: [], entradas: [], lecturas: [] };

/** De cuántos días atrás se mira la evidencia. Más vieja ya no dice cómo llega la fruta ahora. */
export const DIAS_DE_EVIDENCIA = 30;
const EVIDENCIA_MAXIMA = 12;
/** Cuánto puede moverse la estimación en una noche: la quinta parte, y por lo menos un día. */
const PASO = 0.2;

/** Cuántas frutas se le preguntan en una noche. El catálogo del puesto tiene unas 60: lo que no entre, entra la siguiente. */
export const TOPE_POR_NOCHE = 60;
/** Cuánto puede alejarse la estimación de lo que dice la tabla: la mitad, para arriba o para abajo. */
const MARGEN = 0.5;
const MOTIVO_MAXIMO = 160;

const unir = (partes: (string | null | undefined | false)[], separador: string) => partes.filter(Boolean).join(separador);

/** El nombre con todo lo que cambia cuánto aguanta: «Manzana Roja americana Premium, calibre 113, caja de 18 kg». */
const nombreParaElModelo = (p: PartesProducto): string =>
  unir([unir([p.nombre, p.variedad, p.seleccion], " "), p.marca && `marca ${p.marca}`, p.calibre && `calibre ${p.calibre}`, p.kgPorCaja != null && p.kgPorCaja > 0 && `caja de ${p.kgPorCaja} kg`], ", ");

/** Entre cuántos días puede caer la estimación de una fruta, según lo que dice la tabla. Nunca menos de un día. */
export function limitesDe(tabla: number): { minimo: number; maximo: number } {
  return { minimo: Math.max(1, Math.ceil(tabla * (1 - MARGEN))), maximo: Math.max(1, Math.floor(tabla * (1 + MARGEN))) };
}

/**
 * Entre cuántos días puede caer el ajuste de esta noche: un paso desde lo que rige (la quinta parte, y por lo menos un día),
 * sin salir nunca del margen de la tabla. Así una racha de mermas acorta la vida noche a noche, no de golpe.
 */
export function limitesDeAjuste(tabla: number, actual: number): { minimo: number; maximo: number } {
  const margen = limitesDe(tabla);
  const paso = Math.max(1, Math.round(actual * PASO));
  const minimo = Math.min(margen.maximo, Math.max(margen.minimo, actual - paso));
  return { minimo, maximo: Math.max(minimo, Math.min(margen.maximo, actual + paso)) };
}

const dosDecimales = (n: number) => Math.round(n * 100) / 100;

/**
 * La evidencia de una fruta en los últimos 30 días, de lo más nuevo a lo más viejo, y si algo de eso pasó después de `desde`
 * (cuándo se guardó su última estimación). `vida` son los días que hoy se le calculan si llega pintona.
 * Una merma se le cuenta a la llegada más vieja que había en el puesto en ese momento: lo primero que entra es lo primero que
 * se malogra. Lo que no se puede fechar (cajas de hace más de 45 días, o más viejas que las entradas leídas) no es evidencia:
 * no se inventa una edad.
 */
export function evidenciaDe(p: { id: number; nombre: string }, vida: number, desde: string, hechos: Hechos, hoy: string): { evidencia: Evidencia[]; hayNueva: boolean } {
  const vistos: { cuando: number; e: Evidencia }[] = [];
  const reciente = (dia: string) => {
    const hace = diasEntre(dia, hoy);
    return hace >= 0 && hace <= DIAS_DE_EVIDENCIA ? hace : null;
  };
  const gastado = (llegadaDia: string, estado: EstadoLlegada | null, dia: string) => dosDecimales(gastadoAl(llegadaDia, vidaDeLlegada(p.nombre, estado, vida), hechos.lecturas, dia));

  const entradas = hechos.entradas.filter((e) => e.productoId === p.id);
  for (const m of hechos.mermas) {
    if (m.productoId !== p.id) continue;
    const dia = diaDeLima(new Date(m.fecha));
    const haceDias = reciente(dia);
    if (haceDias === null) continue;
    const cuando = Date.parse(m.fecha);
    const llegadas = llegadasEnStock(m.stockAntes, entradas.filter((e) => Date.parse(e.fecha) < cuando));
    const vieja = llegadas[0];
    if (!vieja || llegadas.reduce((s, l) => s + l.cajas, 0) < m.stockAntes - 0.01) continue;
    vistos.push({ cuando, e: { tipo: "merma", haceDias, cajas: m.cajas, gastado: gastado(vieja.dia, vieja.estado, dia) } });
  }
  for (const r of hechos.revisiones) {
    if (r.productoId !== p.id || r.llegadaDia === null) continue;
    const haceDias = reciente(r.dia);
    if (haceDias === null) continue;
    vistos.push({ cuando: Date.parse(r.creadoEn), e: { tipo: "sigue_buena", haceDias, gastado: gastado(r.llegadaDia, r.estado, r.dia) } });
  }
  vistos.sort((a, b) => b.cuando - a.cuando);
  const limite = Date.parse(desde);
  return { evidencia: vistos.slice(0, EVIDENCIA_MAXIMA).map((v) => v.e), hayNueva: vistos.some((v) => v.cuando > limite) };
}

/**
 * A qué frutas hay que estimarles la vida esta noche:
 *  - las que todavía no tienen ninguna estimación (se piden contra la tabla), y
 *  - las que ya tienen una y juntaron evidencia nueva desde entonces (se piden con lo que rige, su paso y la evidencia).
 * Primero las que tienen cajas en el puesto, que son las que mueven el aviso de mañana. Lo ya estimado y sin novedad no se
 * vuelve a preguntar.
 */
export function frutasPorEstimar(
  productos: readonly (PartesProducto & { id: number; stock: number })[],
  vigentes: ReadonlyMap<number, VidaVigente>,
  hechos: Hechos = SIN_HECHOS,
  hoy = diaDeLima(new Date()),
): FrutaPorEstimar[] {
  const pedido: { fruta: FrutaPorEstimar; conCajas: boolean }[] = [];
  for (const p of productos) {
    const tabla = vidaUtilDias(p.nombre);
    const base = { id: p.id, fruta: nombreParaElModelo(p), tabla };
    const vigente = vigentes.get(p.id);
    if (!vigente) {
      pedido.push({ fruta: { ...base, ...limitesDe(tabla) }, conCajas: p.stock > 0 });
      continue;
    }
    // Una estimación por fruta y por día: lo que pase después de la de hoy entra al pedido de mañana.
    if (vigente.dia >= hoy) continue;
    const { evidencia, hayNueva } = evidenciaDe(p, vigente.dias, vigente.creadoEn, hechos, hoy);
    if (hayNueva) pedido.push({ fruta: { ...base, actual: vigente.dias, ...limitesDeAjuste(tabla, vigente.dias), evidencia }, conCajas: p.stock > 0 });
  }
  return pedido
    .map((x, orden) => ({ ...x, orden }))
    .sort((a, b) => Number(b.conCajas) - Number(a.conCajas) || a.orden - b.orden)
    .slice(0, TOPE_POR_NOCHE)
    .map((x) => x.fruta);
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
 * de los límites de esa fruta esta noche (`recortada` dice si hubo que meterla ahí); y con su motivo. Lo que no cumple se
 * descarta y esa fruta sigue con lo que tenía: una estimación a medias no vale más que ninguna. Un ajuste que deja el mismo
 * número también se guarda: así queda dicho que esa evidencia ya se miró, y por qué no cambió nada.
 */
export function aceptarEstimaciones(pedidas: readonly FrutaPorEstimar[], respuesta: RespuestaDelModelo): EstimacionAceptada[] {
  const pedida = new Map(pedidas.map((f) => [f.id, f]));
  const vistas = new Set<number>();
  const aceptadas: EstimacionAceptada[] = [];
  for (const e of respuesta.estimaciones) {
    const fruta = pedida.get(e.producto_id);
    if (fruta === undefined || vistas.has(e.producto_id)) continue;
    vistas.add(e.producto_id);
    const motivo = enUnaLinea(e.motivo);
    if (!Number.isFinite(e.dias) || e.dias <= 0 || motivo === "") continue;
    const { minimo, maximo } = fruta;
    const propuesta = Math.round(e.dias);
    const dias = Math.min(maximo, Math.max(minimo, propuesta));
    aceptadas.push({ productoId: e.producto_id, dias, motivo, recortada: dias !== propuesta });
  }
  return aceptadas;
}
