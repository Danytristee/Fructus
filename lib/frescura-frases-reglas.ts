// Cómo dice Stock lo que le queda a cada llegada: la etiqueta, la frase junto a la barra y el porqué de la hoja. Lógica pura.
// Va aparte de la cuenta (lib/frescura-reglas.ts) para que la cuenta no sepa de pantallas.
import { cuandoLlego, deCuando, diasEntre, hastaCuando, TEMPERATURA_NORMAL, type Estimacion, type Llegada } from "./frescura-reglas";
import { NOMBRE_ESTADO } from "./vida-util-reglas";

type Lote = Llegada & Estimacion;

const cajas = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "caja" : "cajas"}`;
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** El color de una llegada: rojo si sale hoy, ámbar si sale mañana. El texto siempre lo dice también. */
export const tonoDeLlegada = (restan: number): "hoy" | "manana" | "bien" => (restan === 0 ? "hoy" : restan === 1 ? "manana" : "bien");

/** La etiqueta chica de una llegada: «Sale hoy», «Sale mañana», «5 días». */
export const etiquetaDeLlegada = (restan: number): string => (restan === 0 ? "Sale hoy" : restan === 1 ? "Sale mañana" : dias(restan));

/** «12 cajas del lunes»: cómo se nombra una llegada en una fila. */
export const nombreDeLlegada = (lote: Lote, hoy: string): string => `${cajas(lote.cajas)} ${deCuando(lote.dia, hoy)}`;

/** «llegaron el lunes, pintonas» / «llegó ayer»: debajo del nombre de la fruta, en la hoja. */
export function comoYCuandoLlego(lote: Lote, hoy: string): string {
  return `${Math.round(lote.cajas) === 1 ? "llegó" : "llegaron"} ${cuandoLlego(lote.dia, hoy)}${lote.estado ? `, ${NOMBRE_ESTADO[lote.estado].cajas}` : ""}`;
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

/** El veredicto de la hoja «¿por qué?»: qué pasa con esa llegada y hasta cuándo. */
export function veredictoDeLlegada(lote: Lote, hoy: string): { titulo: string; detalle: string } {
  if (lote.atraso > 0) return { titulo: "Tiene que salir hoy", detalle: `Su último día bueno fue ${lote.atraso === 1 ? "ayer" : `hace ${dias(lote.atraso)}`}. Revisa la fruta antes de venderla.` };
  if (lote.restan === 0) return { titulo: "Tiene que salir hoy", detalle: "Hoy es su último día bueno." };
  if (lote.restan === 1) return { titulo: "Sale mañana", detalle: "Mañana es su último día bueno." };
  return { titulo: `Le quedan ${dias(lote.restan)}`, detalle: `Aguanta hasta ${hastaCuando(lote.fin, hoy)}.` };
}

/** Lo que hizo el calor, en una frase: cuánto aguantaba a temperatura normal y cuántos días le quitó. */
export function explicacionDelCalor(lote: Lote, hoy: string): string {
  if (lote.perdidos > 0) {
    const normal = diasEntre(hoy, lote.finNormal) < 0 ? `hace ${dias(-diasEntre(hoy, lote.finNormal))}` : hastaCuando(lote.finNormal, hoy);
    return `A ${TEMPERATURA_NORMAL}° aguantaba hasta ${normal}. El calor le quitó ${dias(lote.perdidos)}.`;
  }
  return lote.dias.some((d) => d.anotada) ? "El clima de estos días no le quitó ningún día." : "Sin temperaturas anotadas, cada día cuenta como uno normal.";
}
