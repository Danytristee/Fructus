// Las frutas de cuerpo redondo u ovalado: cítricos, manzanas, peras, frutas de hueso, mangos y las del norte y la sierra.
import { azar, caliz, desenfoque, elipse, hoja, lineal, mitad, ondular, orbe, puntos, r1, radial, svg, tallo } from "./piezas.mjs";

/** El hueco del pedúnculo: una sombra suave donde nace el tallo. */
const hoyo = (id, x, y, rx, ry, color, op = 0.45) => ({
  defs: radial(`${id}`, x, y, rx, [[0, color, op], [0.6, color, op * 0.4], [1, color, 0]], ` gradientTransform="translate(${x} ${y}) scale(1 ${r1(ry / rx)}) translate(${-x} ${-y})"`),
  cuerpo: `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id})"/>`,
});

/** La costura de las frutas de hueso (durazno, albaricoque, ciruela): un surco con luz de un lado. */
const surco = (d, oscuro, op = 0.35) =>
  `<path d="${d}" fill="none" stroke="${oscuro}" stroke-opacity="${op}" stroke-width="2.2" stroke-linecap="round" filter="url(#bl)"/>` +
  `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${r1(op * 0.6 * 10) / 10}" stroke-width="1" stroke-linecap="round" transform="translate(-1.6 .4)" filter="url(#bl)"/>`;

export const redondas = {
  naranja() {
    const d = elipse(64, 68, 47, 46);
    const o = orbe({
      id: "n", d, cx: 64, cy: 68, R: 47, c: ["#FFC468", "#FB9C2C", "#EE7C14", "#D2600A", "#A54606"], rebote: "#FFB55E",
      textura: { f: 0.42, s: 2.2, min: 0.72, semilla: 4 },
      capas: `<ellipse cx="64" cy="24" rx="26" ry="16" fill="#9AA63A" opacity=".38" filter="url(#bl6)"/>`,
    });
    const h = hoyo("hy", 64, 25, 9, 6, "#6E3206", 0.5);
    return svg(
      "naranja (Valencia, Wando, de jugo): redonda, cáscara con poros, el hombro verdoso de la que llega del valle.",
      o.defs + h.defs + desenfoque("bl6", 6),
      o.cuerpo + h.cuerpo + caliz(64, 24.5, 5, 3.6, 1.4, "#5E6A22") + `<circle cx="64" cy="24.3" r="1.6" fill="#4A3A14"/>`,
    );
  },

  mandarina() {
    const d = "M64 38C80 31 107 36 112 63C117 90 96 114 64 114C32 114 11 90 16 63C21 36 48 31 64 38Z";
    const o = orbe({
      id: "m", d, cx: 64, cy: 74, R: 46, c: ["#FFB04C", "#FA8526", "#EC6514", "#C9480A", "#963204"], rebote: "#FF9E4A",
      textura: { f: 0.5, s: 3, min: 0.68, semilla: 7 }, brillo: 0.9,
    });
    const h = hoyo("hy", 64, 39, 10, 5, "#6E2A04", 0.55);
    const a = hoja("ha", [65, 35], [104, 12], 10, { curva: -0.08 });
    const b = hoja("hb", [62, 35], [36, 15], 7.5, { curva: 0.1, claro: "#5E9E44", oscuro: "#25561F" });
    return svg(
      "mandarina: achatada, de cáscara suelta y granulada, rojiza, con su tallo y dos hojas.",
      o.defs + h.defs + a.defs + b.defs,
      o.cuerpo + h.cuerpo + b.cuerpo + a.cuerpo + tallo([64, 38], [64.5, 34], [65.5, 32], 3, "#4E5A1E", "#8A9A3E"),
    );
  },

  lima() {
    // El pezón es parte de la fruta, abajo a la derecha.
    const d = "M58 22C84 18 106 36 107 62C108 74 104 86 98 94Q104 98 106 104Q101 108 94 101C86 110 74 114 62 114C38 114 20 96 20 70C20 44 34 25 58 22Z";
    const o = orbe({
      id: "l", d, cx: 64, cy: 68, R: 45, c: ["#F2F0A0", "#DCE172", "#B9CC48", "#88A62E", "#5B7A1C"], rebote: "#E8EE9A",
      textura: { f: 0.55, s: 1.6, min: 0.8, semilla: 11 }, brillo: 0.85,
    });
    const h = hoyo("hy", 54, 23, 7, 4, "#4E6014", 0.5);
    return svg(
      "lima: redonda, verde amarilla y lisa, con su pezoncito en la punta.",
      o.defs + h.defs,
      o.cuerpo + h.cuerpo + `<circle cx="54" cy="23" r="2.4" fill="#5E6E22"/>` + tallo([54, 22], [53, 17], [50, 13], 2.6, "#4E5A1E", "#8A9A3E"),
    );
  },

  limon() {
    const entera = orbe({
      id: "e", d: "M50 16C72 14 92 32 92 54C92 76 74 92 52 92C30 92 14 76 14 54C14 32 28 18 50 16Z", cx: 53, cy: 54, R: 38,
      c: ["#C6E777", "#9DD04A", "#6FAE2C", "#4A8A1C", "#2E6212"], rebote: "#B8E07A", textura: { f: 0.6, s: 2, min: 0.74, semilla: 5 }, brillo: 0.9,
    });
    // La mitad cortada: cáscara, piel blanca y diez gajos con su pulpa jugosa.
    const cx = 82;
    const cy = 84;
    let gajos = "";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const b = ((i + 1) / 10) * Math.PI * 2 - Math.PI / 2;
      const [r0, r2] = [3.2, 25];
      const p = (ang, r) => `${r1(cx + Math.cos(ang) * r)} ${r1(cy + Math.sin(ang) * r * 0.94)}`;
      gajos += `<path d="M${p(a + 0.05, r0)}L${p(a + 0.03, r2)}A25 23.5 0 0 1 ${p(b - 0.03, r2)}L${p(b - 0.05, r0)}Z"/>`;
    }
    const corte =
      `<ellipse cx="${cx + 1.5}" cy="${cy + 3.5}" rx="32" ry="30" fill="url(#cs)"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="31" ry="29.3" fill="#5C9A24"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="28.6" ry="27" fill="#EEF4CF"/>` +
      `<g fill="url(#pu)" filter="url(#vs)">${gajos}</g>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="3" ry="2.8" fill="#F4F7DA"/>` +
      `<ellipse cx="${cx - 9}" cy="${cy - 10}" rx="12" ry="6" transform="rotate(-30 ${cx - 9} ${cy - 10})" fill="#fff" opacity=".35" filter="url(#bl2)"/>` +
      `<ellipse cx="${cx - 12}" cy="${cy - 13}" rx="3.6" ry="1.8" transform="rotate(-30 ${cx - 12} ${cy - 13})" fill="#fff" opacity=".8"/>`;
    return svg(
      "limón sutil: verde, chico y redondo, entero y partido, con sus gajos jugosos.",
      entera.defs + radial("pu", cx - 6, cy - 6, 30, [[0, "#E4F3A0"], [0.6, "#C2E266"], [1, "#9BCB3E"]]) +
        lineal("cs", 60, 70, 110, 110, [[0, "#6FAE2C"], [1, "#2E6212"]]) + desenfoque("bl2", 2) +
        `<filter id="vs" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDiffuseLighting surfaceScale="1.6" lighting-color="#fff"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting><feComponentTransfer><feFuncR type="linear" slope=".3" intercept=".72"/><feFuncG type="linear" slope=".3" intercept=".72"/><feFuncB type="linear" slope=".3" intercept=".72"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter>`,
      entera.cuerpo + `<circle cx="48" cy="17.5" r="2" fill="#3E5A16"/>` + corte,
    );
  },

  manzana() {
    return manzana({
      nota: "manzana roja (Royal, Pink Lady, Delicia): roja con vetas, amarilla junto al tallo, cerosa.",
      c: ["#F2565A", "#D4283A", "#A8162A", "#7C0C1E", "#550614"], veta: "#FFB2A0", vetaOscura: "#6E0818", hombro: "#E6C45A", punto: "#FFE0B0", rebote: "#F07A6A",
    });
  },

  "manzana-verde"() {
    return manzana({
      nota: "manzana verde (Granny Smith): verde brillante con lenticelas blancas y un rubor amarillo.",
      c: ["#E2F28C", "#B6DC54", "#86BE38", "#5A9426", "#386A16"], veta: "#EFF6B0", vetaOscura: "#4A7A1A", hombro: "#D8DC62", punto: "#F6FBE0", rebote: "#D6EE8E",
      sinVetas: true,
    });
  },

  pera() {
    const d = "M64 20C72 20 76 30 77 41C78 53 96 62 98 84C100 104 84 118 64 118C44 118 28 104 30 84C32 62 50 53 51 41C52 30 56 20 64 20Z";
    const o = orbe({
      id: "p", d, cx: 62, cy: 80, R: 40, c: ["#EEF08C", "#D2DC5A", "#AAC23E", "#7C9A2A", "#56701A"], rebote: "#E6EA92",
      textura: { f: 0.8, s: 1.2, min: 0.86, semilla: 9 }, brillo: 0.6,
      capas: `<ellipse cx="88" cy="70" rx="16" ry="26" fill="#D98A4A" opacity=".35" filter="url(#bl6)"/>` +
        puntos(21, 140, { cx: 64, cy: 84, rx: 34, ry: 34 }, { rmin: 0.35, rmax: 0.8, color: "#7A5A26", op: 0.55 }) +
        puntos(22, 30, { cx: 64, cy: 40, rx: 10, ry: 18 }, { rmin: 0.3, rmax: 0.7, color: "#7A5A26", op: 0.5 }),
    });
    const a = hoja("ha", [66, 15], [94, 6], 6.5, { curva: -0.1 });
    return svg(
      "pera (Packham, de agua): verde amarilla, cuello largo, pecas cobrizas y rubor de sol.",
      o.defs + a.defs + desenfoque("bl6", 6),
      o.cuerpo + a.cuerpo + tallo([64, 21], [63, 13], [67, 6], 3.2),
    );
  },

  albaricoque() {
    const d = "M62 22C88 20 108 40 108 68C108 96 88 116 63 116C38 116 20 96 20 70C20 42 38 24 62 22Z";
    const o = orbe({
      id: "a", d, cx: 64, cy: 68, R: 45, c: ["#FFD68A", "#FCB054", "#F08E30", "#CF6A18", "#A24E10"], rebote: "#FFC27A",
      textura: { f: 0.9, s: 0.8, min: 0.88, semilla: 13 }, brillo: 0.35,
      capas: `<ellipse cx="88" cy="48" rx="20" ry="22" fill="#E2502A" opacity=".45" filter="url(#bl6)"/>` +
        puntos(31, 70, { cx: 86, cy: 50, rx: 20, ry: 24 }, { rmin: 0.4, rmax: 1.1, color: "#B8301C", op: 0.6 }) +
        surco("M62 24C52 40 50 64 56 86C60 100 64 108 64 115", "#8A3A0E"),
    });
    const h = hoyo("hy", 62, 24, 8, 4.5, "#7A3A0E", 0.5);
    return svg(
      "albaricoque: chico, anaranjado, aterciopelado, con su costura y pecas rojas al sol.",
      o.defs + h.defs + desenfoque("bl6", 6) + desenfoque("bl", 1),
      o.cuerpo + h.cuerpo + tallo([62, 23], [61, 18], [63, 14], 2.6),
    );
  },

  durazno() {
    const d = "M60 26C70 20 84 22 94 30C108 42 112 64 106 84C100 104 84 118 62 117C38 116 18 98 18 72C18 46 38 22 60 26Z";
    const o = orbe({
      id: "d", d, cx: 63, cy: 70, R: 46, c: ["#FFE29A", "#F9C45A", "#EFA036", "#CE7420", "#9E5014"], rebote: "#FFD08A",
      textura: { f: 0.95, s: 0.7, min: 0.9, semilla: 15 }, brillo: 0.3,
      capas: `<path d="M70 22C100 26 116 56 106 88C98 108 84 116 70 112C80 90 76 52 62 34Z" fill="#C8283A" opacity=".75" filter="url(#bl6)"/>` +
        `<ellipse cx="92" cy="62" rx="14" ry="24" fill="#8E1426" opacity=".35" filter="url(#bl6)"/>` +
        surco("M60 27C66 44 66 66 62 86C60 98 60 108 62 116", "#7A1A1A", 0.4),
    });
    const a = hoja("ha", [62, 24], [94, 4], 9, { curva: -0.12 });
    return svg(
      "durazno: amarillo con mejilla roja, piel de terciopelo y su costura marcada.",
      o.defs + a.defs + desenfoque("bl6", 6) + desenfoque("bl", 1),
      o.cuerpo + a.cuerpo + tallo([60, 26], [59, 21], [61, 17], 3),
    );
  },

  ciruela() {
    const d = "M60 22C86 18 108 40 106 70C104 98 84 116 60 114C36 112 20 92 22 66C24 40 38 25 60 22Z";
    const o = orbe({
      id: "c", d, cx: 63, cy: 68, R: 44, c: ["#C0506E", "#8E1E46", "#62102E", "#3E081E", "#260412"], rebote: "#9A3A6A",
      textura: { f: 0.35, s: 1, min: 0.86, semilla: 17 }, brillo: 0.55,
      capas: surco("M60 23C52 42 50 66 54 88C56 100 58 108 60 113", "#1A0208", 0.5),
      // La pruina: el polvillo blanco azulado que la cubre.
      encima: `<rect width="128" height="128" fill="#C8C2E6" opacity=".22" filter="url(#pr)"/>`,
    });
    return svg(
      "ciruela chilena: morada casi negra, ovalada, con su polvillo azulado y su costura.",
      o.defs + desenfoque("bl", 1) +
        `<filter id="pr" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.4 -1"/><feComposite in2="SourceGraphic" operator="in"/></filter>`,
      o.cuerpo + tallo([60, 23], [58, 15], [62, 8], 2.6, "#4E3A1E", "#8A6A3E"),
    );
  },

  cereza() {
    const a = orbe({ id: "a", d: elipse(44, 86, 26, 25), cx: 44, cy: 86, R: 26, c: ["#F26A78", "#D01836", "#960C24", "#600616", "#3A020C"], rebote: "#E0506A", brillo: 1 });
    const b = orbe({ id: "b", d: elipse(86, 78, 27, 26), cx: 86, cy: 78, R: 27, c: ["#F46A7A", "#D41A38", "#9A0C26", "#640618", "#3C020E"], rebote: "#E0506A", brillo: 1 });
    const h = hoja("ha", [70, 16], [104, 22], 8, { curva: 0.2 });
    const hy1 = hoyo("h1", 46, 62, 7, 3.5, "#3A0210", 0.5);
    const hy2 = hoyo("h2", 84, 53, 7, 3.5, "#3A0210", 0.5);
    return svg(
      "cereza chilena: un par, rojo oscuro y brillante, con sus tallos unidos y una hoja.",
      a.defs + b.defs + h.defs + hy1.defs + hy2.defs,
      a.cuerpo + b.cuerpo + hy1.cuerpo + hy2.cuerpo + h.cuerpo +
        tallo([46, 62], [52, 30], [68, 16], 2.4, "#5E6A26", "#A4B058") + tallo([84, 53], [80, 30], [68, 16], 2.4, "#5E6A26", "#A4B058"),
    );
  },

  caqui() {
    const d = "M64 36C84 32 110 38 112 66C114 96 92 116 64 116C36 116 14 96 16 66C18 38 44 32 64 36Z";
    const o = orbe({
      id: "k", d, cx: 64, cy: 76, R: 46, c: ["#FFB25A", "#FA8A2A", "#EC6A16", "#C84C0C", "#943206"], rebote: "#FF9E5A", brillo: 1,
      textura: { f: 0.3, s: 0.6, min: 0.92, semilla: 19 },
      capas: `<path d="M64 40C60 60 60 90 64 115" stroke="#B8460C" stroke-opacity=".25" stroke-width="5" fill="none" filter="url(#bl6)"/>`,
    });
    // El cáliz del caqui: cuatro sépalos anchos, secos en los bordes.
    let sepalos = "";
    for (const [ang, l] of [[-160, 19], [-20, 20], [30, 15], [150, 16]]) {
      const a = (ang * Math.PI) / 180;
      const px = 64 + Math.cos(a) * l;
      const py = 37 + Math.sin(a) * l * 0.45;
      const nx = -Math.sin(a) * 7;
      const ny = Math.cos(a) * 3;
      sepalos += `<path d="M${r1(64 + nx * 0.4)} ${r1(37 + ny * 0.4)}C${r1(64 + nx * 1.6 + (px - 64) * 0.5)} ${r1(37 + ny * 1.6 + (py - 37) * 0.5)} ${r1(px + nx * 0.6)} ${r1(py + ny * 0.6)} ${r1(px)} ${r1(py)}C${r1(px - nx * 0.6)} ${r1(py - ny * 0.6)} ${r1(64 - nx * 1.6 + (px - 64) * 0.5)} ${r1(37 - ny * 1.6 + (py - 37) * 0.5)} ${r1(64 - nx * 0.4)} ${r1(37 - ny * 0.4)}Z"/>`;
    }
    return svg(
      "caqui: achatado y casi cuadrado, naranja encendido y brillante, con su cáliz de cuatro sépalos.",
      o.defs + desenfoque("bl6", 6) + lineal("sp", 40, 30, 90, 44, [[0, "#7E8A3A"], [0.5, "#4E5E22"], [1, "#6A5A26"]]),
      o.cuerpo + `<ellipse cx="64" cy="40" rx="20" ry="5" fill="#7A2E06" opacity=".3" filter="url(#bl6)"/>` +
        `<g fill="url(#sp)" stroke="#2E3410" stroke-opacity=".45" stroke-width=".7">${sepalos}</g>` +
        `<ellipse cx="64" cy="36.5" rx="5" ry="3" fill="#5A4A1E"/>` + tallo([64, 36], [64, 31], [65, 28], 3, "#4A3A1A", "#8A7040"),
    );
  },

  cocona() {
    const d = "M64 30C88 28 110 46 110 72C110 98 90 116 64 116C38 116 18 98 18 72C18 46 40 32 64 30Z";
    const o = orbe({
      id: "o", d, cx: 64, cy: 73, R: 45, c: ["#FFC85A", "#FAA232", "#EE7E1C", "#CC5A12", "#9A3E0C"], rebote: "#FFB45A",
      textura: { f: 1.1, s: 0.8, min: 0.86, semilla: 23 }, brillo: 0.45,
      capas: `<ellipse cx="90" cy="60" rx="18" ry="30" fill="#D9461A" opacity=".4" filter="url(#bl6)"/>`,
    });
    return svg(
      "cocona: de la selva, redonda, naranja rojiza y con pelusa fina, con su cáliz verde de cinco puntas.",
      o.defs + desenfoque("bl6", 6),
      o.cuerpo + `<ellipse cx="64" cy="33" rx="16" ry="5" fill="#6E2E06" opacity=".3" filter="url(#bl6)"/>` +
        caliz(64, 32, 5, 13, 3.4, "#4E7A2A", -90, "#C8E6A0") + `<circle cx="64" cy="31.5" r="3" fill="#3E5A1E"/>` + tallo([64, 31], [64, 25], [66, 21], 3, "#3E5A1E", "#8AAA5A"),
    );
  },

  granadilla() {
    const d = elipse(64, 74, 40, 43);
    const o = orbe({
      id: "g", d, cx: 64, cy: 74, R: 42, c: ["#FFD47A", "#FBB244", "#F0902A", "#D0701A", "#A05212"], rebote: "#FFC27A", brillo: 0.9,
      textura: { f: 0.25, s: 0.6, min: 0.94, semilla: 29 },
      capas: puntos(37, 180, { cx: 64, cy: 74, rx: 40, ry: 43 }, { rmin: 0.35, rmax: 0.85, color: "#FFF4D2", op: 0.85 }),
    });
    const h = hoyo("hy", 64, 32, 7, 4, "#6E3A0A", 0.55);
    return svg(
      "granadilla: ovalada, cáscara dura y lustrosa, naranja con motitas blancas, y su tallo largo.",
      o.defs + h.defs,
      o.cuerpo + h.cuerpo + caliz(64, 32, 3, 6, 2.6, "#9A8A4A", -90, "#E8DCA0") +
        tallo([64, 31], [58, 16], [70, 5], 3.2, "#6A7A2A", "#B6C46A"),
    );
  },

  membrillo() {
    const d = "M60 22C72 20 82 28 86 38C98 44 110 60 108 80C106 102 88 118 64 118C40 118 20 104 20 80C20 60 32 46 42 38C46 28 50 23 60 22Z";
    const o = orbe({
      id: "q", d, cx: 64, cy: 76, R: 45, c: ["#FAF09A", "#EED45A", "#D8B232", "#B08A1E", "#7E6212"], rebote: "#F6E08A",
      textura: { f: 0.12, o: 3, s: 2.5, min: 0.82, semilla: 31 }, brillo: 0.45,
      // La pelusa gris que le queda en parches.
      encima: `<rect width="128" height="128" fill="#E8E2D0" opacity=".3" filter="url(#pe)"/>`,
    });
    const a = hoja("ha", [62, 19], [30, 6], 9, { curva: 0.12, claro: "#7AA84E", oscuro: "#3A6A28" });
    return svg(
      "membrillo: dorado, abollado y con su pelusa en parches, tallo grueso y hoja.",
      o.defs + a.defs +
        `<filter id="pe" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 3 -1.5"/><feComposite in2="SourceGraphic" operator="in"/></filter>`,
      o.cuerpo + a.cuerpo + tallo([60, 23], [60, 15], [64, 9], 3.6),
    );
  },

  tuna() {
    const d = "M44 18C56 12 74 12 86 18C100 26 108 50 106 76C104 100 88 118 64 118C40 118 24 100 22 76C20 50 30 26 44 18Z";
    // Las aréolas: cada una en su lomito, con un punto café y un mechón de espinitas claras. Van en filas que dan la vuelta a la fruta,
    // corridas un poco al azar, como en la tuna de verdad.
    const az = azar(81);
    let areolas = "";
    for (let fila = 0; fila < 8; fila++) {
      const y0 = 28 + fila * 11.5;
      const t = (y0 - 68) / 52;
      const rx = 42 * Math.sqrt(Math.max(0, 1 - t * t));
      for (let k = -4; k <= 4; k++) {
        const th = (k + (fila % 2) * 0.5) * 0.36 + (az() - 0.5) * 0.12;
        if (Math.abs(th) > 1.36) continue;
        const x = 64 + rx * Math.sin(th);
        const y = y0 + (az() - 0.5) * 3;
        const e = Math.cos(th);
        const s = 0.8 + az() * 0.45;
        areolas +=
          `<ellipse cx="${r1(x - 0.6)}" cy="${r1(y - 1.8)}" rx="${r1(4.2 * e * s)}" ry="${r1(3.4 * s)}" fill="#FFF0B0" opacity=".28"/>` +
          `<ellipse cx="${r1(x + 0.4)}" cy="${r1(y + 2)}" rx="${r1(3.6 * e * s)}" ry="${r1(1.8 * s)}" fill="#6E2A0E" opacity=".22"/>` +
          `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1((1.3 * e + 0.4) * s)}" ry="${r1(1.2 * s)}" fill="#5A3A14" opacity=".85"/>` +
          `<path d="M${r1(x)} ${r1(y)}l${r1(-1.8 * e * s)} ${r1(-2.4 * s)}M${r1(x)} ${r1(y)}l${r1(-0.5 * e * s)} ${r1(-3 * s)}M${r1(x)} ${r1(y)}l${r1(0.8 * e * s)} ${r1(-2.9 * s)}M${r1(x)} ${r1(y)}l${r1(1.9 * e * s)} ${r1(-2.2 * s)}" stroke="#FAF0C4" stroke-width=".5" opacity=".9"/>`;
      }
    }
    const o = orbe({
      id: "t", d, cx: 64, cy: 70, R: 46, c: ["#F4DC74", "#E6B444", "#DC8A30", "#B05C22", "#723814"], rebote: "#EEC070",
      textura: { f: 0.6, s: 0.8, min: 0.9, semilla: 33 }, brillo: 0.45,
      capas: `<path d="M18 74C26 104 46 120 64 118C40 118 24 100 18 74Z" fill="#8AA03A" opacity=".6" filter="url(#bl6)"/>` +
        `<ellipse cx="34" cy="86" rx="14" ry="26" fill="#9AAE40" opacity=".45" filter="url(#bl6)"/>` +
        `<ellipse cx="74" cy="30" rx="28" ry="14" fill="#D2502E" opacity=".4" filter="url(#bl6)"/>` + areolas,
    });
    const h = hoyo("hy", 64, 20, 16, 5, "#6E2A0E", 0.5);
    // La tuna partida: cáscara gruesa y pulpa naranja llena de pepitas.
    const m = mitad("m", {
      cx: 90, cy: 92, rx: 27, ry: 25, cascara: "#D88A36", canto: ["#B8742A", "#6E3A12"], piel: "#F2C46A",
      pulpa: ["#FFC468", "#F59A36", "#E07A26"], textura: { f: 0.5, s: 1.6, min: 0.8, semilla: 4 },
      pepas: { n: 46, color: "#7A4E22", brillo: "#E8C890", rmin: 0.8, rmax: 1.2, zona: 0.85, alargo: 1.3, radial: false }, semilla: 9,
    });
    return svg(
      "tuna: el fruto del nopal, ovalada y de tope chato, de verde a naranja, con sus aréolas de espinitas; entera y partida.",
      o.defs + h.defs + m.defs + desenfoque("bl6", 6),
      `<g transform="translate(-6 -6) scale(.84)">${o.cuerpo}${h.cuerpo}<ellipse cx="64" cy="19.5" rx="9" ry="2.6" fill="#7A4A1E" opacity=".55"/></g>` + m.cuerpo,
    );
  },

  tumbo() {
    const d = "M16 30C24 20 44 24 66 38C90 53 116 74 114 94C112 108 94 110 72 98C48 85 24 66 15 50C11 42 11 35 16 30Z";
    const o = orbe({
      id: "u", d, cx: 66, cy: 66, R: 46, c: ["#FAEE9A", "#F2D864", "#E2BC3E", "#BE9426", "#86681A"], rebote: "#F6E296",
      textura: { f: 1, s: 0.7, min: 0.9, semilla: 37 }, brillo: 0.35,
      capas: `<ellipse cx="108" cy="88" rx="14" ry="12" fill="#8AA03A" opacity=".45" filter="url(#bl6)"/>` +
        // Las costillas suaves que corren a lo largo del tumbo.
        `<g fill="none" stroke="#B89232" stroke-opacity=".28" stroke-width="2.4" filter="url(#bl2)"><path d="M18 40C40 50 70 70 112 90"/><path d="M24 30C50 40 84 62 114 82"/><path d="M16 50C38 64 64 84 100 102"/></g>` +
        puntos(41, 70, { cx: 66, cy: 64, rx: 44, ry: 26 }, { rmin: 0.3, rmax: 0.7, color: "#A68A2A", op: 0.45 }),
    });
    // El tumbo partido a lo largo: cáscara delgada, una capa blanca y la pulpa naranja de sacos jugosos con pepas negras.
    const m = mitad("m", {
      cx: 80, cy: 94, rx: 34, ry: 15, giro: -24, cascara: "#E8C850", canto: ["#C8A43A", "#7A6418"], piel: "#FBF4D8",
      pulpa: ["#FFC456", "#F59E2E", "#E8861E"], textura: { f: 0.32, s: 3, min: 0.72, semilla: 6 },
      pepas: { n: 26, color: "#1E140C", brillo: "#9A8A7A", rmin: 1, rmax: 1.4, zona: 0.85, alargo: 1.5, radial: false }, semilla: 11,
    });
    return svg(
      "tumbo: de la sierra, alargado, amarillo y aterciopelado, verde en la punta; entero y partido, con su pulpa naranja y pepas negras.",
      o.defs + m.defs + desenfoque("bl6", 6) + desenfoque("bl2", 2),
      `<g transform="translate(-2 -14) scale(.92)">${o.cuerpo}${caliz(23, 40, 4, 5, 2, "#7A8A3A", 200, "#E8F0B0")}${tallo([22, 39], [14, 30], [12, 20], 3, "#5E6A26", "#A4B058")}</g>` + m.cuerpo,
    );
  },

  pepino() {
    const d = "M62 16C88 16 110 42 110 72C110 100 90 118 64 118C38 118 18 100 18 72C18 42 36 16 62 16Z";
    // Las rayas moradas del pepino dulce siguen los meridianos de la fruta.
    let rayas = "";
    for (const [dx, w, op] of [[-30, 3.2, 0.75], [-16, 4.6, 0.85], [0, 3.6, 0.8], [14, 5, 0.85], [28, 3.4, 0.7], [39, 2.4, 0.6], [-41, 2.2, 0.55]]) {
      rayas += `<path d="M${64 + dx * 0.4} 26C${64 + dx * 1.15} 44 ${64 + dx * 1.15} 92 ${64 + dx * 0.5} 110" fill="none" stroke="#6E2E7E" stroke-width="${r1(w * 1.25)}" stroke-opacity="${r1(op * 0.75 * 100) / 100}" stroke-linecap="round"/>`;
    }
    const o = orbe({
      id: "p", d, cx: 64, cy: 68, R: 47, c: ["#FFFBDA", "#F6EAB2", "#E6CF7A", "#C2A452", "#8A7236"], rebote: "#F6EEC4", brillo: 1,
      capas: `<g filter="url(#on)"><g filter="url(#br)">${rayas}</g></g>`,
    });
    return svg(
      "pepino dulce: ovalado, crema amarillo con rayas moradas, liso y brillante.",
      o.defs + desenfoque("br", 1.1) + ondular("on", { f: 0.07, escala: 7, semilla: 3 }),
      o.cuerpo + caliz(62, 18, 5, 6, 2, "#5E7A2E", -90, "#C8E6A0") + tallo([62, 17], [62, 11], [64, 7], 2.8, "#4E6A22", "#8AAA5A"),
    );
  },

  nispero() {
    const fruto = (id, cx, cy, rx, ry, giro) => {
      const o = orbe({
        id, d: elipse(cx, cy, rx, ry), cx, cy, R: (rx + ry) / 2, c: ["#FFD678", "#FBB246", "#EE902A", "#C86E1A", "#965012"], rebote: "#FFC478",
        textura: { f: 0.9, s: 0.7, min: 0.9, semilla: cx }, brillo: 0.55,
        capas: puntos(cx * 3, 30, { cx, cy, rx, ry }, { rmin: 0.35, rmax: 0.9, color: "#9A5A1A", op: 0.5 }),
      });
      // El ojo del extremo: la flor seca que le queda abajo.
      return { defs: o.defs, cuerpo: `<g transform="rotate(${giro} ${cx} ${cy})">${o.cuerpo}${caliz(cx, cy + ry - 3, 5, 3, 1.2, "#5A3410", 0, "#E8C890")}</g>` };
    };
    const h = hoja("ha", [62, 18], [116, 40], 13, { curva: -0.08, claro: "#5E8E3E", oscuro: "#2A5222" });
    const a = fruto("a", 40, 78, 22, 26, 12);
    const b = fruto("b", 86, 80, 22, 26, -10);
    const c = fruto("c", 62, 92, 23, 26, 0);
    return svg(
      "níspero: un racimito de frutos ovalados, amarillo anaranjados con pecas, la flor seca abajo y su hoja larga.",
      h.defs + a.defs + b.defs + c.defs,
      h.cuerpo + tallo([62, 18], [46, 30], [42, 52], 2.6, "#6A5A2A", "#B0985A") + tallo([62, 18], [80, 30], [84, 54], 2.6, "#6A5A2A", "#B0985A") +
        tallo([62, 18], [62, 40], [62, 66], 2.8, "#6A5A2A", "#B0985A") + a.cuerpo + b.cuerpo + c.cuerpo,
    );
  },

  "mango-kent"() {
    const d = "M60 20C86 18 106 40 106 70C106 98 88 118 62 118C38 118 22 100 22 74C22 46 36 22 60 20Z";
    const o = orbe({
      id: "k", d, cx: 64, cy: 70, R: 47, c: ["#ECDC66", "#C6C848", "#93AE36", "#638A26", "#3E6018"], rebote: "#D8DA74",
      textura: { f: 0.7, s: 0.8, min: 0.9, semilla: 43 }, brillo: 0.75,
      capas: `<ellipse cx="88" cy="36" rx="30" ry="26" fill="#8E1E36" opacity=".85" filter="url(#bl8)"/>` +
        `<ellipse cx="70" cy="56" rx="26" ry="20" fill="#F2B83E" opacity=".45" filter="url(#bl8)"/>` +
        puntos(47, 170, { cx: 64, cy: 70, rx: 43, ry: 48 }, { rmin: 0.35, rmax: 0.85, color: "#F6EEB4", op: 0.75 }),
    });
    const h = hoyo("hy", 58, 22, 9, 5, "#3A2A0A", 0.5);
    return svg(
      "mango Kent (el 90 % del mango peruano): redondo y rollizo, verde amarillo con rubor vino en el hombro y lenticelas claras.",
      o.defs + h.defs + desenfoque("bl8", 8),
      o.cuerpo + h.cuerpo + tallo([58, 21], [56, 14], [60, 7], 3.2),
    );
  },

  "mango-edward"() {
    const d = "M56 14C80 10 98 34 100 62C102 92 90 118 66 120C42 122 28 104 28 74C28 44 36 18 56 14Z";
    const o = orbe({
      id: "e", d, cx: 64, cy: 66, R: 48, c: ["#FFE48A", "#FFC64A", "#F4A22E", "#D07A1A", "#9E5612"], rebote: "#FFD478",
      textura: { f: 0.7, s: 0.8, min: 0.9, semilla: 53 }, brillo: 0.8,
      capas: `<ellipse cx="80" cy="34" rx="24" ry="30" fill="#E2424A" opacity=".7" filter="url(#bl8)"/>` +
        `<ellipse cx="40" cy="104" rx="16" ry="14" fill="#9AA83A" opacity=".35" filter="url(#bl8)"/>` +
        puntos(57, 150, { cx: 64, cy: 66, rx: 34, ry: 52 }, { rmin: 0.35, rmax: 0.8, color: "#FFF6C8", op: 0.7 }),
    });
    const h = hoyo("hy", 55, 16, 8, 4.5, "#5A2A0A", 0.5);
    return svg(
      "mango Edward: alargado y dorado, con rubor rosado en el hombro, lenticelas finas y su piquito.",
      o.defs + h.defs + desenfoque("bl8", 8),
      o.cuerpo + h.cuerpo + tallo([55, 15], [52, 9], [56, 4], 3),
    );
  },
};

function manzana({ nota, c, veta, vetaOscura, hombro, punto, rebote, sinVetas }) {
  const d = "M64 34C54 25 28 22 19 46C10 70 24 108 44 113C52 115 58 111 64 111C70 111 76 115 84 113C104 108 118 70 109 46C100 22 74 25 64 34Z";
  // Las vetas: rayas finas del tallo al fondo, onduladas, unas claras y otras oscuras.
  const az = azar(61);
  let vetas = "";
  if (!sinVetas) {
    for (let i = 0; i < 48; i++) {
      const x = 22 + az() * 84;
      const curva = (x - 64) * 0.5;
      const clara = az() > 0.45;
      vetas += `<path d="M${r1(64 + (x - 64) * 0.2)} 36C${r1(x + curva * 0.2)} 50 ${r1(x + curva * 0.15)} 90 ${r1(64 + (x - 64) * 0.6)} 112" fill="none" stroke="${clara ? veta : vetaOscura}" stroke-width="${r1(0.6 + az() * 1.4)}" stroke-opacity="${r1((clara ? 0.12 + az() * 0.1 : 0.16 + az() * 0.12) * 100) / 100}"/>`;
    }
  }
  const o = orbe({
    id: "z", d, cx: 64, cy: 70, R: 47, c, rebote, brillo: 1,
    textura: { f: 0.35, s: 0.5, min: 0.94, semilla: 63 },
    capas: `<ellipse cx="64" cy="36" rx="26" ry="16" fill="${hombro}" opacity=".7" filter="url(#bl8)"/>` +
      (sinVetas ? `<ellipse cx="88" cy="56" rx="18" ry="22" fill="#E6E25A" opacity=".45" filter="url(#bl8)"/>` : "") +
      `<g filter="url(#on)"><g filter="url(#bv)">${vetas}</g></g>` +
      puntos(67, 80, { cx: 64, cy: 72, rx: 42, ry: 38 }, { rmin: 0.3, rmax: 0.75, color: punto, op: 0.6 }),
  });
  const h = hoyo("hy", 64, 36, 13, 6, "#3A0A08", 0.55);
  const fondo = hoyo("hf", 64, 111, 9, 3, "#3A0A08", 0.35);
  const a = hoja("ha", [66, 18], [98, 8], 8.5, { curva: -0.15 });
  return svg(
    `${nota}`,
    o.defs + h.defs + fondo.defs + a.defs + desenfoque("bl8", 8) + desenfoque("bv", 0.7) + ondular("on", { f: 0.05, escala: 5, semilla: 5 }),
    o.cuerpo + h.cuerpo + fondo.cuerpo + a.cuerpo + tallo([64, 36], [63, 24], [67, 12], 3.4),
  );
}
