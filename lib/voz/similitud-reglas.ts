// La misma similitud por trigramas que pg_trgm (similarity), para listas cortas que no tienen su RPC de búsqueda
// (proveedores). Así «el de chao» y «Agrícola Chao» se comparan igual que en buscar_clientes. Lógica pura.

function trigramas(texto: string): Set<string> {
  const conjunto = new Set<string>();
  for (const palabra of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const relleno = `  ${palabra} `;
    for (let i = 0; i < relleno.length - 2; i++) conjunto.add(relleno.slice(i, i + 3));
  }
  return conjunto;
}

/** Entre 0 y 1: trigramas en común sobre trigramas en total (como similarity() de pg_trgm). */
export function similitud(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / (ta.size + tb.size - comunes);
}
