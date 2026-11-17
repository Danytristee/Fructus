// «a 500» después de una fruta es el precio por caja, nunca el total. Se decide contando, no se le pide al modelo: Gemini (el respaldo
// de último recurso) ponía «Vendí 10 cajas de mango a 500 y pagó solo 1000» con total_item 500, la tarjeta dividía (S/ 50 la caja) y,
// como lo pagado llegaba a ese total, la venta salía al contado (/voz-precision 2026-11-17). Lógica pura.

type Item = { precio_unitario: number | null; total_item?: number | null };

/** Las formas en que Whisper escribe un monto: «500», «1000», «1,000», «45.50», «45,50». */
function formas(n: number): string[] {
  const entero = Number.isInteger(n);
  const fijo = n.toFixed(2);
  const lista = entero ? [String(n), n.toLocaleString("en-US")] : [fijo, fijo.replace(".", ",")];
  return [...new Set(lista)].map((s) => s.replace(/\./g, "\\."));
}

/** ¿La frase dice «a N» (o «a N soles», «a S/ N»), con N como precio de algo? */
export function dijoA(transcripcion: string, n: number): boolean {
  return formas(n).some((f) => new RegExp(`(^|[^\\p{L}])a\\s+(s\\/\\s*)?${f}(?![\\d.,]*\\d)`, "iu").test(transcripcion));
}

/** Si un «total» es en realidad lo que se dijo como «a N», vuelve a ser el precio por caja. Lo demás no se toca. */
export function precioQueEraTotal<T extends Item>(transcripcion: string, items: T[]): T[] {
  return items.map((it) =>
    it.precio_unitario === null && it.total_item != null && dijoA(transcripcion, it.total_item)
      ? { ...it, precio_unitario: it.total_item, total_item: null }
      : it,
  );
}
