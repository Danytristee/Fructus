// El aviso de stock en la tarjeta de venta (Informe T3): la fila de la fruta que no alcanza dice «Solo hay 6», y la voz «según la app te
// quedan 6 cajas…». Avisa, no bloquea: la venta se guarda igual (registrar_venta no revisa el stock). En el puesto se vende muchas veces
// antes de anotar la compra que llegó, así que el stock de la app puede ir atrasado; por eso, al guardar, se recuerda la compra. Lógica
// pura.
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
 * Lo que dice la fila de la fruta que no alcanza, bajo su precio: «Solo hay 6». Sin stock o en negativo no se muestra una cifra
 * imposible (como en las consultas por voz, 31-10): «No te queda». Va en la fila y no en un recuadro aparte: con tres frutas, el
 * recuadro de 157 px quedaba debajo de Confirmar (/formidable 2026-11-18). La voz lo sigue diciendo entero (lectura-reglas.ts).
 */
export function faltaEnFila(a: AvisoStock): string {
  return a.quedan <= 0 ? "No te queda" : `Solo hay ${cifra(a.quedan)}`;
}

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
