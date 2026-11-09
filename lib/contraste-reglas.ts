// Contraste de color (WCAG 2), para que la legibilidad al sol se mida y no se suponga.
//
// El problema: un color «que se ve bien» en el escritorio puede leerse mal a pleno sol. CLAUDE.md pide 7:1 en textos y cifras clave, 4.5:1
// en lo secundario y 3:1 en los bordes de los campos. Mal hecho: el verde de «cobrado» que traía la propuesta (#348B50) daba 3.9:1.

/** Luminancia relativa de un color #rrggbb. */
function luminancia(hex: string): number {
  const lineal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineal(1) + 0.7152 * lineal(3) + 0.0722 * lineal(5);
}

/** El contraste entre dos colores #rrggbb: de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Los tokens de color (#rrggbb) de un bloque de globals.css: `:root` (claro) o `[data-theme="oscuro"]`. */
export function tokensDe(css: string, selector: ":root" | '[data-theme="oscuro"]'): Record<string, string> {
  const inicio = css.indexOf(`${selector}${selector === ":root" ? ",\n" : " {"}`);
  if (inicio < 0) throw new Error(`No encontré el bloque ${selector} en globals.css`);
  const bloque = css.slice(inicio, css.indexOf("}", inicio));
  const tokens: Record<string, string> = {};
  for (const m of bloque.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) {
    if (m[1] && m[2]) tokens[m[1]] = m[2].toLowerCase();
  }
  return tokens;
}
