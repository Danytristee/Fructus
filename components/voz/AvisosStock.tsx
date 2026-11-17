import { useEffect, useRef, useState } from "react";

import { stockDe } from "@/app/(app)/acciones-voz";
import { Aviso } from "@/components/ui/Aviso";
import type { ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import { avisosStock, SUGERENCIA_AVISO, textoAviso } from "@/lib/voz/stock-venta-reglas";

type Props = {
  items: ItemBorrador[];
  /** El stock que trajo la tarjeta del servidor (al dictar o al corregir hablando). */
  inicial?: Record<number, number>;
  className?: string;
};

// El aviso de stock de la tarjeta de venta: avisa, no bloquea (stock-venta-reglas.ts). El stock de lo dictado viene con la tarjeta;
// el de una fruta elegida tocando se pide aquí, una sola vez por fruta, aunque falle: sin stock leído no hay aviso, nunca una cifra
// inventada.
export function AvisosStock({ items, inicial, className }: Props) {
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

  const avisos = avisosStock(items, new Map(Object.entries(conocido).map(([id, cajas]) => [Number(id), cajas])));
  if (avisos.length === 0) return null;
  return (
    <div className={className}>
      {avisos.map((a, n) => (
        // La pregunta por la compra va una vez, en el último: con dos frutas no se repite.
        <Aviso key={a.productoId} tipo="atencion" titulo={textoAviso(a)} className={n > 0 ? "mt-2" : undefined}>
          {n === avisos.length - 1 ? SUGERENCIA_AVISO : undefined}
        </Aviso>
      ))}
    </div>
  );
}
