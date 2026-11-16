// Cómo dice Stock lo que le queda a cada llegada: la etiqueta, la frase junto a la barra y el porqué de la hoja. Lógica pura.
// Va aparte de la cuenta (lib/frescura-reglas.ts) para que la cuenta no sepa de pantallas.
import { cuandoLlego, deCuando, diasEntre, hastaCuando, type Estimacion, type Llegada } from "./frescura-reglas";
import type { OrigenVida } from "./inventario-reglas";
import { NOMBRE_ESTADO } from "./vida-util-reglas";

type Lote = Llegada & Estimacion & { revisada?: boolean };

const cajas = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "caja" : "cajas"}`;
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** El color de una llegada: rojo si sale hoy, ámbar si sale mañana. El texto siempre lo dice también. */
export const tonoDeLlegada = (restan: number): "hoy" | "manana" | "bien" => (restan === 0 ? "hoy" : restan === 1 ? "manana" : "bien");

/** La etiqueta chica de una llegada: «Sale hoy», «Sale mañana», «5 días». */
export const etiquetaDeLlegada = (restan: number): string => (restan === 0 ? "Sale hoy" : restan === 1 ? "Sale mañana" : dias(restan));

/** «12 cajas del lunes»: cómo se nombra una llegada en una fila. */
export const nombreDeLlegada = (lote: Lote, hoy: string): string => `${cajas(lote.cajas)} ${deCuando(lote.dia, hoy, lote.antes)}`;

/** «llegaron el lunes, pintonas» / «llegó ayer»: debajo del nombre de la fruta, en la hoja. */
export function comoYCuandoLlego(lote: Lote, hoy: string): string {
  return `${Math.round(lote.cajas) === 1 ? "llegó" : "llegaron"} ${cuandoLlego(lote.dia, hoy, lote.antes)}${lote.estado ? `, ${NOMBRE_ESTADO[lote.estado].cajas}` : ""}`;
}

/**
 * La frase junto a la barra de una fruta. Con una sola llegada dice lo suyo («Sale hoy», «Le quedan 5 días»); con varias,
 * cuántas cajas hay en cada caso: «12 salen hoy · 30 aguantan 5 días». Sin llegadas conocidas no dice nada.
 */
export function fraseDeLlegadas(lotes: readonly Pick<Lote, "cajas" | "restan">[]): string {
  if (lotes.length === 0) return "";
  if (lotes.length === 1) return lotes[0]!.restan > 1 ? `Le quedan ${dias(lotes[0]!.restan)}` : etiquetaDeLlegada(lotes[0]!.restan);
  return lotes
    .map((l) => {
      const n = Math.round(l.cajas);
      if (l.restan === 0) return `${n} ${n === 1 ? "sale" : "salen"} hoy`;
      if (l.restan === 1) return `${n} ${n === 1 ? "sale" : "salen"} mañana`;
      return `${n} ${n === 1 ? "aguanta" : "aguantan"} ${dias(l.restan)}`;
    })
    .join(" · ");
}

/**
 * El veredicto de la hoja «¿por qué?»: qué pasa con esa llegada y hasta cuándo. Si su último día bueno ya pasó, lo primero es
 * mirarla: «Tiene que salir hoy» encima de «Su último día bueno fue ayer» dejaba la duda de si ya estaba mala (/formidable 2026-11-14).
 */
export function veredictoDeLlegada(lote: Lote, hoy: string): { titulo: string; detalle: string } {
  // Ya había pasado su día, pero alguien la miró hoy: lo primero es decir que eso quedó anotado.
  if (lote.revisada) return { titulo: "Sigue buena", detalle: "La revisaste hoy. Mañana vuelve a mirarla." };
  // De hace más de 45 días no se sabe el día: no se inventa cuál fue su último día bueno.
  if (lote.antes) return { titulo: "Revísala antes de vender", detalle: `Lleva más de ${dias(diasEntre(lote.dia, hoy))} en el puesto.` };
  if (lote.atraso > 0) return { titulo: "Revísala antes de vender", detalle: `Su último día bueno fue ${lote.atraso === 1 ? "ayer" : `hace ${dias(lote.atraso)}`}.` };
  if (lote.restan === 0) return { titulo: "Tiene que salir hoy", detalle: "Hoy es su último día bueno." };
  if (lote.restan === 1) return { titulo: "Sale mañana", detalle: "Mañana es su último día bueno." };
  return { titulo: `Le quedan ${dias(lote.restan)}`, detalle: `Aguanta hasta ${hastaCuando(lote.fin, hoy)}.` };
}

/**
 * Qué hacer con esa llegada, debajo del porqué. Si su último día bueno ya pasó, la app no sabe si la fruta sigue buena: dice qué
 * hacer en los dos casos. «Véndelo hoy» al lado de «Su último día bueno fue ayer» dejaba esa duda (/formidable 2026-11-15).
 * null si todavía aguanta: no hay nada que hacer.
 */
export function consejoDeLlegada(lote: Lote): string | null {
  if (lote.revisada) return "Ponla adelante y véndela hoy, aunque sea con rebaja.";
  if (lote.atraso > 0) return "Si sigue buena, véndela hoy con rebaja. Si no, anótala con «Se malogró».";
  if (lote.restan === 0) return "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja.";
  return lote.restan === 1 ? "Ponlo adelante y véndelo primero." : null;
}

/** Lo que hizo el calor, en una frase: cuánto aguantaba con clima normal (24°, que en pantalla no se nombra) y cuántos días le quitó. */
export function explicacionDelCalor(lote: Lote, hoy: string): string {
  if (lote.perdidos > 0) {
    const normal = diasEntre(hoy, lote.finNormal) < 0 ? `hace ${dias(-diasEntre(hoy, lote.finNormal))}` : hastaCuando(lote.finNormal, hoy);
    return `Con clima normal aguantaba hasta ${normal}. El calor le quitó ${dias(lote.perdidos)}.`;
  }
  return lote.dias.some((d) => d.anotada) ? "El clima de estos días no le quitó ningún día." : "Sin temperaturas anotadas, cada día cuenta como uno normal.";
}

/**
 * De dónde sale la cuenta, al pie de la hoja «¿por qué?»: con cuántos días se contó esa llegada y quién lo dijo, la tabla del
 * sistema o la IA (con el día y su motivo). Si la IA la revisó y quedó en lo mismo que la tabla, se dice eso y no su motivo, que
 * sería «no encuentro nada que la distinga». null si la llegada no lleva cuenta (cajas de hace más de 45 días).
 */
export function origenDeLaCuenta(lote: { vida: number | null }, origen: OrigenVida, hoy: string): string | null {
  if (lote.vida === null) return null;
  const n = Math.max(1, Math.round(lote.vida));
  const cuento = `Para estas cajas cuento ${n === 1 ? "un día" : `unos ${n} días`} con clima normal`;
  if (origen.fuente === "tabla") return `${cuento}, según la tabla del sistema.`;
  if (origen.dias === origen.tabla) return `${cuento}. La IA lo revisó ${cuandoLlego(origen.dia, hoy)} y coincide con la tabla del sistema.`;
  const motivo = origen.motivo.trim();
  return `${cuento}. Lo estimó la IA ${cuandoLlego(origen.dia, hoy)}: ${/[.!?…]$/.test(motivo) ? motivo : `${motivo}.`}`;
}
