// El aviso de stock en la tarjeta de venta (Informe T3): «Según la app te quedan 6 cajas de Mango Kent y vas a vender 10». Avisa, no
// bloquea: la venta se guarda igual (registrar_venta no revisa el stock). En el puesto se vende muchas veces antes de anotar la compra
// que llegó, así que el stock de la app puede ir atrasado; por eso «según la app» y la pregunta por la compra. Lógica pura.
import { formatearCajas } from "../formato";
import type { ItemBorrador } from "./confirmar-venta-reglas";

/** Una fruta de la venta que pide más cajas de las que la app cree que hay. */
export type AvisoStock = { productoId: number; producto: string; vendes: number; quedan: number };

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Las frutas de la venta que piden más de lo que hay, en el orden en que aparecen. Suma las cajas de una misma fruta aunque se dicte
 * dos veces. `stock`: las cajas que hay de cada fruta (de v_stock); la que no está ahí no se sabe y no se avisa: nunca un aviso con
 * una cifra que no se leyó.
 */
export function avisosStock(items: ItemBorrador[], stock: ReadonlyMap<number, number>): AvisoStock[] {
  const porFruta = new Map<number, { producto: string; vendes: number }>();
  for (const it of items) {
    if (it.productoId === null) continue;
    const previo = porFruta.get(it.productoId);
    porFruta.set(it.productoId, { producto: previo?.producto ?? it.producto, vendes: redondear((previo?.vendes ?? 0) + it.cantidad) });
  }
  return [...porFruta].flatMap(([productoId, { producto, vendes }]) => {
    const quedan = stock.get(productoId);
    return quedan === undefined || vendes <= quedan ? [] : [{ productoId, producto, vendes, quedan }];
  });
}

/** El stock como viene en la tarjeta (un objeto por id, por JSON) a lo que pide avisosStock. */
export const mapaStock = (stock?: Record<number, number>): ReadonlyMap<number, number> =>
  new Map(Object.entries(stock ?? {}).map(([id, cajas]) => [Number(id), cajas]));

const cifra = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("es-PE", { maximumFractionDigits: 2 }));

/**
 * El aviso, en pantalla. Sin stock o en negativo no se muestra una cifra imposible (como en las consultas por voz, 31-10): «no te
 * queda». «Según la app»: lo que dice la app puede ir atrás de lo que hay en el puesto.
 */
export function textoAviso(a: AvisoStock): string {
  if (a.quedan <= 0) return `Según la app no te queda ${a.producto}.`;
  return `Según la app te ${a.quedan === 1 ? "queda" : "quedan"} ${formatearCajas(a.quedan)} de ${a.producto} y vas a vender ${cifra(a.vendes)}.`;
}

/**
 * Un solo aviso para toda la venta: con uno por fruta, a 360 px el total y «Pagó / Lo debe» se iban de la pantalla (/formidable
 * 2026-11-17). Con una fruta es textoAviso; con varias, «Según la app no alcanza: de Mango Kent te quedan 6 cajas y vas a vender 10;
 * de Palta Fuerte no te queda.»
 */
export function textoAvisos(avisos: AvisoStock[]): string {
  if (avisos.length === 1) return textoAviso(avisos[0]!);
  const partes = avisos.map((a) =>
    a.quedan <= 0 ? `de ${a.producto} no te queda` : `de ${a.producto} te ${a.quedan === 1 ? "queda" : "quedan"} ${formatearCajas(a.quedan)} y vas a vender ${cifra(a.vendes)}`,
  );
  return `Según la app no alcanza: ${partes.join("; ")}.`;
}

/**
 * Lo que se le ofrece al dueño: que confirme igual (la prueba ciega dudó si la venta iba a «rebotar») y que casi siempre es una compra
 * que llegó y no se anotó.
 */
export const SUGERENCIA_AVISO = "Igual puedes confirmarla. ¿Falta anotar una compra?";

/**
 * Después de guardar: el aviso se iba con la tarjeta y la compra se olvidaba (prueba ciega). «Falta anotar la compra de Mango Kent:
 * díctala o anótala en Stock.» Compra está en la barra de Stock y también se dicta.
 */
export function recordatorioCompra(avisos: AvisoStock[]): string | null {
  if (avisos.length === 0) return null;
  const nombres = avisos.map((a) => a.producto);
  const frutas = nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  return avisos.length === 1
    ? `Falta anotar la compra de ${frutas}: díctala o anótala en Stock.`
    : `Falta anotar las compras de ${frutas}: díctalas o anótalas en Stock.`;
}
