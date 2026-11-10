// Piezas para dibujar las frutas de public/frutas/ (ADR-0014): volumen, textura de cáscara, brillos, hojas y puntos.
// Todo en un lienzo de 128 × 128 y con la luz arriba a la izquierda, para que las frutas se vean de la misma familia.

export const r1 = (n) => Math.round(n * 10) / 10;

/** Azar con semilla: el mismo dibujo cada vez que se genera. */
export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const paradas = (lista) =>
  lista.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a !== 1 ? ` stop-opacity="${a}"` : ""}/>`).join("");

export const radial = (id, cx, cy, r, lista, extra = "") =>
  `<radialGradient id="${id}" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" gradientUnits="userSpaceOnUse"${extra}>${paradas(lista)}</radialGradient>`;
export const lineal = (id, x1, y1, x2, y2, lista) =>
  `<linearGradient id="${id}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" gradientUnits="userSpaceOnUse">${paradas(lista)}</linearGradient>`;
/** Un degradado que se acomoda a cada figura (uvas, semillas, ojos de la piña). */
export const radialCaja = (id, cx, cy, r, lista) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${paradas(lista)}</radialGradient>`;

/**
 * Relieve de cáscara: ruido iluminado desde arriba a la izquierda y multiplicado sobre el color. `f` es lo fino del poro, `s` lo hondo y
 * `min` cuánto oscurece el fondo del poro (1 = nada).
 */
export const textura = (id, { f = 0.5, o = 2, s = 2, min = 0.8, semilla = 1, elev = 55 } = {}) =>
  `<filter id="${id}" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="${o}" seed="${semilla}"/>` +
  `<feDiffuseLighting surfaceScale="${s}" lighting-color="#fff"><feDistantLight azimuth="225" elevation="${elev}"/></feDiffuseLighting>` +
  `<feComponentTransfer>${["R", "G", "B"].map((c) => `<feFunc${c} type="linear" slope="${r1((1 - min) * 100) / 100}" intercept="${min}"/>`).join("")}</feComponentTransfer>` +
  `<feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>`;

export const desenfoque = (id, d) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;

/** Ondula los bordes de lo que toca (vetas, manchas): nada queda con trazo de regla. */
export const ondular = (id, { f = 0.06, escala = 4, semilla = 2 } = {}) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="2" seed="${semilla}"/>` +
  `<feDisplacementMap in="SourceGraphic" scale="${escala}" xChannelSelector="R" yChannelSelector="G"/></filter>`;

export const elipse = (cx, cy, rx, ry) =>
  `M${r1(cx - rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx + rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx - rx)} ${r1(cy)}Z`;

export const svg = (nota, defs, cuerpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n<!-- Fructus · ${nota} Generado con scripts/frutas/generar.mjs. -->\n<defs>${defs}</defs>\n${cuerpo}\n</svg>\n`;

/**
 * Un cuerpo redondo con volumen: color base iluminado desde arriba a la izquierda, luz de rebote abajo, textura, brillo suave y brillo duro.
 * `c` son cinco tonos, de la luz a la sombra del borde. `brillo` va de 0 (mate, como el durazno) a 1 (encerado, como la manzana).
 */
export function orbe({ id, d, cx, cy, R, c, textura: tx, brillo = 0.8, rebote, capas = "", encima = "", borde = "#000" }) {
  const lx = cx - 0.38 * R;
  const ly = cy - 0.42 * R;
  let defs =
    `<clipPath id="${id}c"><path d="${d}"/></clipPath>` +
    radial(`${id}b`, lx, ly, 1.55 * R, [[0, c[0]], [0.3, c[1]], [0.62, c[2]], [0.86, c[3]], [1, c[4]]]) +
    radial(`${id}h`, 0, 0, 1, [[0, "#fff", 0.62 * brillo], [1, "#fff", 0]], ` gradientTransform="translate(${r1(lx)} ${r1(ly)}) rotate(-38) scale(${r1(0.4 * R)} ${r1(0.26 * R)})"`) +
    desenfoque(`${id}f`, r1(R * 0.012 + 0.3));
  if (rebote) defs += radial(`${id}r`, cx + 0.12 * R, cy + 1.02 * R, 0.8 * R, [[0, rebote, 0.42], [1, rebote, 0]]);
  if (tx) defs += textura(`${id}t`, tx);
  const fondo =
    `<path d="${d}" fill="url(#${id}b)"/>` +
    `<g clip-path="url(#${id}c)">${rebote ? `<rect width="128" height="128" fill="url(#${id}r)"/>` : ""}${capas}` +
    `<rect width="128" height="128" fill="url(#${id}h)"/></g>`;
  const cuerpo =
    (tx ? `<g filter="url(#${id}t)">${fondo}</g>` : fondo) +
    `<g clip-path="url(#${id}c)">${encima}` +
    (brillo > 0.3
      ? `<ellipse cx="${r1(lx - 0.05 * R)}" cy="${r1(ly - 0.04 * R)}" rx="${r1(0.13 * R)}" ry="${r1(0.075 * R)}" transform="rotate(-38 ${r1(lx - 0.05 * R)} ${r1(ly - 0.04 * R)})" fill="#fff" opacity="${r1(0.85 * brillo * 10) / 10}" filter="url(#${id}f)"/>`
      : "") +
    `</g><path d="${d}" fill="none" stroke="${borde}" stroke-opacity=".22" stroke-width=".8"/>`;
  return { defs, cuerpo };
}

/** Puntos sueltos dentro de una elipse (lenticelas del mango, pecas de la pera, motas de la granadilla). */
export function puntos(semilla, n, { cx, cy, rx, ry }, { rmin = 0.5, rmax = 1, color, op = 0.7, margen = 0.92 }) {
  const az = azar(semilla);
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = az() * Math.PI * 2;
    const m = Math.sqrt(az()) * margen;
    const x = cx + Math.cos(a) * rx * m;
    const y = cy + Math.sin(a) * ry * m;
    // Hacia el borde se ven de lado: más chicos y más tenues.
    const borde = 1 - m * m * 0.6;
    s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1((rmin + az() * (rmax - rmin)) * borde)}" ry="${r1((rmin + az() * (rmax - rmin)) * borde * 0.8)}" opacity="${r1(op * borde * 10) / 10}"/>`;
  }
  return `<g fill="${color}">${s}</g>`;
}

/** Una hoja con nervadura: de la base `b` a la punta `p`, con ancho `w` y curva `curva` (positiva, hacia la izquierda del avance). */
export function hoja(id, b, p, w, { curva = 0.15, claro = "#6FB04E", oscuro = "#2C6328", vena = "#C9E3A6" } = {}) {
  const [bx, by] = b;
  const [px, py] = p;
  const L = Math.hypot(px - bx, py - by);
  const ux = (px - bx) / L;
  const uy = (py - by) / L;
  const nx = -uy;
  const ny = ux;
  const mx = bx + ux * L * 0.45 + nx * L * curva;
  const my = by + uy * L * 0.45 + ny * L * curva;
  const a = [mx + nx * w, my + ny * w];
  const z = [mx - nx * w * 0.85, my - ny * w * 0.85];
  const d = `M${r1(bx)} ${r1(by)}Q${r1(a[0])} ${r1(a[1])} ${r1(px)} ${r1(py)}Q${r1(z[0])} ${r1(z[1])} ${r1(bx)} ${r1(by)}Z`;
  const defs = lineal(`${id}g`, mx + nx * w, my + ny * w, mx - nx * w, my - ny * w, [[0, claro], [0.55, oscuro], [1, oscuro]]) +
    `<clipPath id="${id}c"><path d="${d}"/></clipPath>`;
  let venas = `M${r1(bx)} ${r1(by)}Q${r1(mx)} ${r1(my)} ${r1(px)} ${r1(py)}`;
  for (const k of [0.22, 0.38, 0.54, 0.7]) {
    // La nervadura media sigue la misma curva: se calcula el punto sobre ella.
    const t = k;
    const qx = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * px;
    const qy = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * py;
    for (const lado of [1, -1]) {
      venas += `M${r1(qx)} ${r1(qy)}q${r1(ux * L * 0.08 + nx * w * 0.5 * lado)} ${r1(uy * L * 0.08 + ny * w * 0.5 * lado)} ${r1(ux * L * 0.18 + nx * w * 0.85 * lado)} ${r1(uy * L * 0.18 + ny * w * 0.85 * lado)}`;
    }
  }
  const cuerpo =
    `<path d="${d}" fill="url(#${id}g)"/>` +
    `<g clip-path="url(#${id}c)"><path d="${venas}" fill="none" stroke="${vena}" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M${r1(bx)} ${r1(by)}Q${r1(a[0])} ${r1(a[1])} ${r1(px)} ${r1(py)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/></g>` +
    `<path d="${d}" fill="none" stroke="#173A14" stroke-opacity=".3" stroke-width=".6"/>`;
  return { defs, cuerpo };
}

/** Un tallo leñoso con su luz: de `a` a `b` pasando cerca de `c`. */
export const tallo = (a, c, b, grosor = 3.2, color = "#6B4A22", luz = "#A8804A") =>
  `<path d="M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round"/>` +
  `<path d="M${a[0] - 0.5} ${a[1]}Q${c[0] - 0.6} ${c[1]} ${b[0] - 0.5} ${b[1]}" fill="none" stroke="${luz}" stroke-width="${r1(grosor * 0.3)}" stroke-linecap="round" opacity=".7"/>`;

/** Una estrella de sépalos (el cáliz de la cocona, del caqui, la mancha del extremo del níspero). */
export function caliz(cx, cy, n, largo, ancho, color, giro = 0, luz = "#fff") {
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 360 + giro) * (Math.PI / 180);
    const px = cx + Math.cos(a) * largo;
    const py = cy + Math.sin(a) * largo * 0.62;
    const nx = -Math.sin(a) * ancho;
    const ny = Math.cos(a) * ancho * 0.62;
    s += `<path d="M${r1(cx + nx)} ${r1(cy + ny)}Q${r1((cx + px) / 2 + nx * 1.3)} ${r1((cy + py) / 2 + ny * 1.3)} ${r1(px)} ${r1(py)}Q${r1((cx + px) / 2 - nx * 1.3)} ${r1((cy + py) / 2 - ny * 1.3)} ${r1(cx - nx)} ${r1(cy - ny)}Z"/>`;
  }
  return `<g fill="${color}" stroke="${luz}" stroke-opacity=".25" stroke-width=".5">${s}</g>`;
}

/**
 * Una fruta partida vista de frente: el canto de la cáscara, la piel blanca si tiene, la pulpa con su textura y sus pepas. Es la misma
 * receta del limón y del kiwi, para el tumbo, la tuna y la chirimoya.
 */
export function mitad(id, { cx, cy, rx, ry, giro = 0, cascara, canto, piel, pulpa, textura: tx, pepas, semilla = 1 }) {
  const az = azar(semilla);
  const g = (n) => r1(n);
  let semillas = "";
  if (pepas) {
    const { n, color, brillo = "#fff", rmin = 0.8, rmax = 1.4, zona = 0.8, radial: hacia = true, alargo = 1.6 } = pepas;
    for (let i = 0; i < n; i++) {
      const a = az() * Math.PI * 2;
      const m = Math.sqrt(az()) * zona;
      const x = cx + Math.cos(a) * (rx - 4) * m;
      const y = cy + Math.sin(a) * (ry - 4) * m;
      const r = rmin + az() * (rmax - rmin);
      const ang = hacia ? (a * 180) / Math.PI : az() * 180;
      semillas += `<g transform="rotate(${g(ang)} ${g(x)} ${g(y)})"><ellipse cx="${g(x)}" cy="${g(y)}" rx="${g(r * alargo)}" ry="${g(r)}" fill="${color}"/>` +
        `<ellipse cx="${g(x - r * 0.4)}" cy="${g(y - r * 0.35)}" rx="${g(r * 0.45)}" ry="${g(r * 0.3)}" fill="${brillo}" opacity=".55"/></g>`;
    }
  }
  const defs =
    lineal(`${id}k`, cx - rx, cy - ry, cx + rx, cy + ry, [[0, canto[0]], [1, canto[1]]]) +
    radial(`${id}p`, cx - rx * 0.2, cy - ry * 0.25, Math.max(rx, ry) * 1.05, [[0, pulpa[0]], [0.65, pulpa[1]], [1, pulpa[2] ?? pulpa[1]]]) +
    (tx ? textura(`${id}t`, tx) : "") + desenfoque(`${id}b`, 1.6);
  const p = piel ? 2.2 : 0;
  const cuerpo =
    `<g transform="rotate(${giro} ${cx} ${cy})">` +
    `<ellipse cx="${cx + 1.4}" cy="${cy + 3.2}" rx="${rx + 0.6}" ry="${ry + 0.6}" fill="url(#${id}k)"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${cascara}"/>` +
    (piel ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 2.2}" ry="${ry - 2.2}" fill="${piel}"/>` : "") +
    `<g${tx ? ` filter="url(#${id}t)"` : ""}><ellipse cx="${cx}" cy="${cy}" rx="${g(rx - 2.4 - p)}" ry="${g(ry - 2.4 - p)}" fill="url(#${id}p)"/></g>` +
    semillas +
    `<ellipse cx="${g(cx - rx * 0.3)}" cy="${g(cy - ry * 0.38)}" rx="${g(rx * 0.38)}" ry="${g(ry * 0.16)}" transform="rotate(-25 ${g(cx - rx * 0.3)} ${g(cy - ry * 0.38)})" fill="#fff" opacity=".32" filter="url(#${id}b)"/>` +
    `<ellipse cx="${g(cx - rx * 0.4)}" cy="${g(cy - ry * 0.45)}" rx="${g(rx * 0.1)}" ry="${g(ry * 0.05)}" transform="rotate(-25 ${g(cx - rx * 0.4)} ${g(cy - ry * 0.45)})" fill="#fff" opacity=".8"/>` +
    `</g>`;
  return { defs, cuerpo };
}
