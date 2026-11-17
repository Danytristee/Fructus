import { useEffect, useRef, useState } from "react";

import { stockDe } from "@/app/(app)/acciones-voz";
import type { ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import { avisosStock, mapaStock, type AvisoStock } from "@/lib/voz/stock-venta-reglas";

/**
 * Las frutas de la venta que piden más de lo que hay (stock-venta-reglas.ts). El stock de lo dictado viene con la tarjeta (`inicial`);
 * el de una fruta elegida tocando se pide aquí, una sola vez por fruta, aunque falle: sin stock leído no hay aviso, nunca una cifra
 * inventada. Vive en la tarjeta y no en el aviso porque «Venta guardada» también lo usa, para recordar la compra que falta.
 */
export function useStockVenta(items: ItemBorrador[], inicial?: Record<number, number>): AvisoStock[] {
  const [leido, setLeido] = useState<Record<number, number>>({});
  const pedidos = useRef(new Set<number>());
  const conocido = { ...leido, ...inicial };

  const clave = [...new Set(items.flatMap((it) => (it.productoId !== null && !(it.productoId in conocido) ? [it.productoId] : [])))].join(",");
  useEffect(() => {
    // Cada fruta se pide una vez. Si falla, la clave no cambia y no se reintenta en bucle. La respuesta no se descarta al elegir otra
    // fruta mientras llega: la primera se quedaría sin su stock.
    const ids = clave === "" ? [] : clave.split(",").map(Number).filter((id) => !pedidos.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) pedidos.current.add(id);
    void stockDe(ids)
      .catch(() => null)
      .then((s) => s && setLeido((l) => ({ ...l, ...s })));
  }, [clave]);

  return avisosStock(items, mapaStock(conocido));
}
