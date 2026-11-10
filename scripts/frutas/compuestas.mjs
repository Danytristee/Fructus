// Las frutas que se arman de muchas piezas: racimos (plátano, uva), escamas (piña, chirimoya) y las que se venden partidas para mostrar
// la pulpa (papaya, palta, kiwi).
import { azar, desenfoque, elipse, lineal, orbe, r1, radial, radialCaja, svg, tallo, textura } from "./piezas.mjs";

/**
 * Un plátano: una curva del tallo `c` a la punta `t`, combada `comba` hacia su izquierda, con su ancho, sus caras (la de arriba con luz,
 * la de abajo en sombra), el cuello verde, la punta negra y sus pecas.
 */
function platano(id, c, t, { comba, ancho, tonos, pecas = 0, manchas = 0, semilla = 1, oscuro = 0 }) {
  const [cx, cy] = c;
  const [tx, ty] = t;
  const L = Math.hypot(tx - cx, ty - cy);
  const nx = -(ty - cy) / L;
  const ny = (tx - cx) / L;
  const px = (cx + tx) / 2 + nx * comba;
  const py = (cy + ty) / 2 + ny * comba;
  const punto = (u) => [(1 - u) ** 2 * cx + 2 * (1 - u) * u * px + u * u * tx, (1 - u) ** 2 * cy + 2 * (1 - u) * u * py + u * u * ty];
  const normal = (u) => {
    const dx = 2 * (1 - u) * (px - cx) + 2 * u * (tx - px);
    const dy = 2 * (1 - u) * (py - cy) + 2 * u * (ty - py);
    const m = Math.hypot(dx, dy);
    return [-dy / m, dx / m];
  };
  const anchoEn = (u) => ancho * (0.26 + 0.74 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.04) / 0.99))) ** 0.5);
  const lado = (k, desde = 0, hasta = 1) => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const u = desde + ((hasta - desde) * i) / 20;
      const [x, y] = punto(u);
      const [mx, my] = normal(u);
      const w = anchoEn(u) / 2;
      pts.push(`${r1(x + mx * w * k)} ${r1(y + my * w * k)}`);
    }
    return pts;
  };
  const poli = (a, b) => `M${a.join("L")}L${b.reverse().join("L")}Z`;
  // La cara con luz es la que mira hacia arriba, venga de donde venga la curva.
  const k = normal(0.5)[1] > 0 ? -1 : 1;
  const cuerpo = poli(lado(1), lado(-1));
  const caraLuz = poli(lado(k), lado(0.2 * k));
  const caraSombra = poli(lado(-0.35 * k), lado(-k));
  const cuello = poli(lado(1, 0, 0.13), lado(-1, 0, 0.13));
  const [ex, ey] = punto(1);
  const [fx, fy] = normal(1);
  const az = azar(semilla);
  let motas = "";
  for (let i = 0; i < pecas; i++) {
    const u = 0.15 + az() * 0.8;
    const [x, y] = punto(u);
    const [mx, my] = normal(u);
    const s = (az() - 0.5) * 0.8 * anchoEn(u);
    motas += `<ellipse cx="${r1(x + mx * s)}" cy="${r1(y + my * s)}" rx="${r1(0.4 + az() * 0.8)}" ry="${r1(0.3 + az() * 0.5)}"/>`;
  }
  let parches = "";
  for (let i = 0; i < manchas; i++) {
    const u = 0.2 + az() * 0.75;
    const [x, y] = punto(u);
    const [mx, my] = normal(u);
    const s = (az() - 0.5) * 0.7 * anchoEn(u);
    parches += `<ellipse cx="${r1(x + mx * s)}" cy="${r1(y + my * s)}" rx="${r1(1.5 + az() * 3)}" ry="${r1(1 + az() * 2)}"/>`;
  }
  const defs = `<clipPath id="${id}c"><path d="${cuerpo}"/></clipPath>`;
  const dibujo =
    `<path d="${cuerpo}" fill="${tonos[1]}"/>` +
    `<g clip-path="url(#${id}c)">` +
    `<path d="${caraLuz}" fill="${tonos[0]}"/>` +
    `<path d="${caraSombra}" fill="${tonos[2]}"/>` +
    `<path d="${lado(0.2 * k).join("L").replace(/^/, "M")}" fill="none" stroke="${tonos[0]}" stroke-width="1.4" stroke-opacity=".6" filter="url(#bl)"/>` +
    (parches ? `<g fill="#5A3A12" opacity=".5" filter="url(#bl)">${parches}</g>` : "") +
    (motas ? `<g fill="#3E2608" opacity=".8">${motas}</g>` : "") +
    `<path d="${cuello}" fill="#8EA03A" opacity=".85" filter="url(#bl)"/>` +
    (oscuro ? `<rect width="128" height="128" fill="#3A2A06" opacity="${oscuro}"/>` : "") +
    `</g><path d="${cuerpo}" fill="none" stroke="#5E4206" stroke-opacity=".45" stroke-width=".8"/>` +
    `<ellipse cx="${r1(ex + (ex - punto(0.97)[0]) * 0.6)}" cy="${r1(ey + (ey - punto(0.97)[1]) * 0.6)}" rx="${r1(ancho * 0.16)}" ry="${r1(ancho * 0.12)}" transform="rotate(${r1((Math.atan2(fy, fx) * 180) / Math.PI)} ${r1(ex)} ${r1(ey)})" fill="#2E1E0A"/>`;
  return { defs, dibujo };
}

function racimo(nota, manos, { corona, tonos, pecas, manchas }) {
  let defs = desenfoque("bl", 0.8);
  let cuerpo = "";
  manos.forEach(([t, comba, ancho, oscuro], i) => {
    const p = platano(`p${i}`, corona, t, { comba, ancho, tonos, pecas, manchas, semilla: 7 + i * 13, oscuro });
    defs += p.defs;
    cuerpo += p.dibujo;
  });
  // La corona: el pedazo de vástago del que cuelgan, cortado a machete.
  const [x, y] = corona;
  cuerpo += `<path d="M${x - 9} ${y - 16}Q${x - 4} ${y - 6} ${x + 4} ${y + 3}L${x - 2} ${y + 7}Q${x - 10} ${y - 2} ${x - 15} ${y - 12}Z" fill="url(#vs)"/>` +
    `<ellipse cx="${x - 12}" cy="${y - 14}" rx="3.6" ry="2.6" transform="rotate(-40 ${x - 12} ${y - 14})" fill="#C8B67A" stroke="#6A5420" stroke-width=".7"/>`;
  defs += lineal("vs", x - 15, y - 12, x + 4, y + 3, [[0, "#6E7A2A"], [0.6, "#4E5A1A"], [1, "#3A3A12"]]);
  // Un racimo es más ancho que alto: se baja para que quede centrado en el cuadro.
  return svg(nota, defs, `<g transform="translate(0 14)">${cuerpo}</g>`);
}

export const compuestas = {
  "platano-seda"() {
    return racimo(
      "plátano de seda: el de todos los días, largo, delgado y curvo, amarillo parejo con alguna peca.",
      [
        [[118, 30], 30, 15, 0.22],
        [[120, 50], 30, 16, 0.12],
        [[116, 70], 28, 16.5, 0.05],
        [[106, 88], 24, 17, 0],
      ],
      { corona: [18, 22], tonos: ["#FFE874", "#F6CF34", "#C99A16"], pecas: 6 },
    );
  },

  "platano-isla"() {
    return racimo(
      "plátano de isla: corto, grueso y de aristas marcadas, amarillo con manchas negras cuando está maduro.",
      [
        [[112, 42], 20, 22, 0.18],
        [[114, 66], 20, 23, 0.08],
        [[104, 90], 18, 24, 0],
      ],
      { corona: [24, 30], tonos: ["#FFE070", "#EFC032", "#BE8E14"], pecas: 40, manchas: 8 },
    );
  },

  "platano-bizcocho"() {
    return racimo(
      "plátano bizcocho: chiquito y rechoncho, dulce, amarillo intenso con pecas finas.",
      [
        [[100, 38], 14, 21, 0.2],
        [[104, 58], 14, 22, 0.12],
        [[100, 78], 13, 23, 0.05],
        [[88, 96], 11, 23, 0],
      ],
      { corona: [30, 36], tonos: ["#FFE46A", "#F8C42A", "#C88E10"], pecas: 22 },
    );
  },

  pina() {
    const cx = 64;
    const cy = 86;
    const rx = 30;
    const ry = 36;
    // Los ojos de la piña: hexágonos en espiral que dan la vuelta a la fruta. Se calculan sobre el cilindro y se proyectan, así los de los
    // costados se ven de lado.
    let ojos = "";
    for (let fila = 0; fila < 11; fila++) {
      const y = cy - ry + 4 + fila * 6.6;
      const t = (y - cy) / ry;
      const ancho = rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (let k = -5; k <= 5; k++) {
        const th = (k + (fila % 2) * 0.5) * 0.34;
        if (Math.abs(th) > 1.42) continue;
        const x = cx + ancho * Math.sin(th);
        const w = ancho * 0.34 * Math.cos(th) * 1.05 + 0.4;
        const h = 4.4;
        ojos += `<path d="M${r1(x - w / 2)} ${r1(y)}L${r1(x - w / 4)} ${r1(y - h)}L${r1(x + w / 4)} ${r1(y - h)}L${r1(x + w / 2)} ${r1(y)}L${r1(x + w / 4)} ${r1(y + h)}L${r1(x - w / 4)} ${r1(y + h)}Z"/>` +
          `<path d="M${r1(x - w * 0.12)} ${r1(y + h * 0.95)}L${r1(x)} ${r1(y + h * 0.25)}L${r1(x + w * 0.12)} ${r1(y + h * 0.95)}Z" fill="#6A4A10" opacity=".75"/>`;
      }
    }
    const d = elipse(cx, cy, rx, ry);
    const defs =
      `<clipPath id="bc"><path d="${d}"/></clipPath>` +
      radialCaja("ojo", 0.42, 0.38, 0.75, [[0, "#FFE07A"], [0.55, "#F2B23A"], [1, "#B47014"]]) +
      radial("vol", cx - 12, cy - 16, 48, [[0, "#fff", 0.3], [0.45, "#fff", 0], [0.75, "#3A2406", 0.15], [1, "#3A2406", 0.6]]) +
      radial("pie", cx, cy + ry, 26, [[0, "#6E8A2A", 0.55], [1, "#6E8A2A", 0]]) +
      lineal("hj", 0, 0, 0, 1, [[0, "#86B87A"], [1, "#2E5E3C"]]).replace('gradientUnits="userSpaceOnUse"', "");
    // La corona: hojas duras en abanico, las de atrás más oscuras.
    let corona = "";
    const hojas = [[-118, 34, 0.55], [-62, 34, 0.55], [-104, 42, 0.4], [-76, 42, 0.4], [-132, 26, 0.3], [-48, 26, 0.3], [-96, 46, 0.15], [-84, 46, 0.15], [-90, 38, 0], [-112, 30, 0], [-68, 30, 0]];
    for (const [ang, largo, sombra] of hojas) {
      const a = (ang * Math.PI) / 180;
      const bx = cx + Math.cos(a) * 3;
      const by = cy - ry + 6;
      const px = cx + Math.cos(a) * largo;
      const py = by + Math.sin(a) * largo;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const w = 4.2;
      const qx = (bx + px) / 2 - uy * 3;
      const qy = (by + py) / 2 + ux * 3;
      corona += `<path d="M${r1(bx - uy * w)} ${r1(by + ux * w)}Q${r1(qx - uy * w * 0.8)} ${r1(qy + ux * w * 0.8)} ${r1(px)} ${r1(py)}Q${r1(qx + uy * w * 0.4)} ${r1(qy - ux * w * 0.4)} ${r1(bx + uy * w)} ${r1(by - ux * w)}Z" fill="url(#hj)" stroke="#1E3E26" stroke-opacity=".4" stroke-width=".6"/>` +
        `<path d="M${r1(bx)} ${r1(by)}Q${r1(qx)} ${r1(qy)} ${r1(px)} ${r1(py)}" stroke="#C6E0B0" stroke-opacity=".5" stroke-width=".7" fill="none"/>` +
        (sombra ? `<path d="M${r1(bx - uy * w)} ${r1(by + ux * w)}Q${r1(qx - uy * w * 0.8)} ${r1(qy + ux * w * 0.8)} ${r1(px)} ${r1(py)}Q${r1(qx + uy * w * 0.4)} ${r1(qy - ux * w * 0.4)} ${r1(bx + uy * w)} ${r1(by - ux * w)}Z" fill="#0E2414" opacity="${sombra}"/>` : "");
    }
    const cuerpo =
      corona +
      `<path d="${d}" fill="#C88A22"/>` +
      `<g clip-path="url(#bc)"><g fill="url(#ojo)" stroke="#7A4E10" stroke-opacity=".7" stroke-width=".7">${ojos}</g>` +
      `<rect width="128" height="128" fill="url(#pie)"/><rect width="128" height="128" fill="url(#vol)"/></g>` +
      `<path d="${d}" fill="none" stroke="#5A3A08" stroke-opacity=".35" stroke-width=".8"/>`;
    return svg("piña golden: dorada, con sus ojos en espiral y su corona de hojas verde azuladas.", defs, cuerpo);
  },

  uva() {
    // Red globe: granos grandes, rojo vino, en un racimo que se angosta hacia abajo. Se dibujan de atrás hacia adelante.
    const granos = [
      [44, 40, 13, 0.35], [66, 36, 13, 0.35], [88, 42, 12.5, 0.35],
      [34, 58, 13, 0.18], [56, 56, 13.5, 0.15], [78, 58, 13.5, 0.15], [98, 62, 12, 0.2],
      [44, 76, 13.5, 0.08], [68, 76, 14, 0.05], [90, 80, 12.5, 0.1],
      [54, 96, 13, 0.02], [78, 98, 13, 0.02],
      [64, 114, 11.5, 0],
    ];
    let cuerpo = tallo([66, 24], [64, 14], [72, 6], 3.2, "#6A6A2A", "#B0B06A") + tallo([66, 24], [52, 26], [44, 30], 2, "#6A6A2A", "#B0B06A") + tallo([66, 24], [80, 26], [88, 32], 2, "#6A6A2A", "#B0B06A");
    for (const [x, y, r, sombra] of granos) {
      cuerpo += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gr)"/>` +
        `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#pr)"/>` +
        (sombra ? `<circle cx="${x}" cy="${y}" r="${r}" fill="#1E0410" opacity="${sombra}"/>` : "") +
        `<ellipse cx="${r1(x - r * 0.38)}" cy="${r1(y - r * 0.42)}" rx="${r1(r * 0.2)}" ry="${r1(r * 0.12)}" transform="rotate(-38 ${r1(x - r * 0.38)} ${r1(y - r * 0.42)})" fill="#fff" opacity=".75" filter="url(#bl)"/>` +
        `<circle cx="${r1(x + r * 0.15)}" cy="${r1(y + r * 0.62)}" r=".9" fill="#2A0614" opacity=".6"/>`;
    }
    return svg(
      "uva red globe (y la iqueña): granos grandes, rojo vino, con su polvillo y el escobajo verde.",
      radialCaja("gr", 0.38, 0.32, 0.78, [[0, "#F08AA2"], [0.22, "#C83E66"], [0.6, "#8C1840"], [0.88, "#560A26"], [1, "#3A0618"]]) +
        radialCaja("pr", 0.62, 0.78, 0.6, [[0, "#E6C8E0", 0.28], [1, "#E6C8E0", 0]]) + desenfoque("bl", 0.8),
      `<g filter="url(#tx)">${cuerpo}</g>`.replace('<g filter="url(#tx)">', "<g>"),
    );
  },

  papaya() {
    const giro = "rotate(-16 64 66)";
    const piel = "M64 8C84 8 98 30 100 62C102 96 88 122 64 122C40 122 26 96 28 62C30 30 44 8 64 8Z";
    const pulpa = "M64 14C80 14 92 34 94 62C96 92 84 116 64 116C44 116 32 92 34 62C36 34 48 14 64 14Z";
    const hueco = "M64 32C73 32 79 50 79 70C79 92 72 104 64 104C56 104 49 92 49 70C49 50 55 32 64 32Z";
    // Las pepas: negras y brillosas, cada una con su gelatina, apiñadas en el hueco.
    const az = azar(71);
    let pepas = "";
    const lista = [];
    for (let y = 38; y <= 100; y += 4.6) {
      const t = (y - 70) / 34;
      const ancho = 14 * Math.sqrt(Math.max(0, 1 - t * t));
      for (let x = 64 - ancho; x <= 64 + ancho; x += 5) lista.push([x + (az() - 0.5) * 2.4, y + (az() - 0.5) * 2.2, 2.3 + az() * 0.9]);
    }
    for (const [x, y, r] of lista.sort((a, b) => a[1] - b[1])) {
      pepas += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r + 0.9)}" fill="#7A2A1A" opacity=".45"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="url(#pp)"/>` +
        `<circle cx="${r1(x - r * 0.35)}" cy="${r1(y - r * 0.4)}" r="${r1(r * 0.28)}" fill="#fff" opacity=".7"/>`;
    }
    const defs =
      `<clipPath id="pc"><path d="${pulpa}"/></clipPath>` +
      lineal("pi", 30, 20, 100, 110, [[0, "#C8C83E"], [0.5, "#8AA82E"], [1, "#4E7420"]]) +
      radial("pu", 58, 60, 62, [[0, "#FF9A5A"], [0.45, "#FA7A3E"], [0.8, "#EE6A30"], [1, "#F4A23E"]]) +
      radial("hu", 60, 60, 36, [[0, "#E2563A"], [1, "#B8381E"]]) +
      radialCaja("pp", 0.38, 0.35, 0.7, [[0, "#6A625C"], [0.35, "#2A2420"], [1, "#0E0A08"]]) +
      textura("tp", { f: 0.7, s: 1.4, min: 0.84, semilla: 3 }) + desenfoque("bl", 2);
    const cuerpo =
      `<g transform="${giro}">` +
      `<path d="${piel}" fill="url(#pi)"/>` +
      `<path d="${pulpa}" fill="#F7B44A"/>` +
      `<g filter="url(#tp)"><path d="M64 17C79 17 90 36 92 62C94 90 83 113 64 113C45 113 34 90 36 62C38 36 49 17 64 17Z" fill="url(#pu)"/></g>` +
      `<g clip-path="url(#pc)"><path d="${hueco}" fill="#9A2E18" opacity=".45" filter="url(#bl)" transform="translate(1.5 2)"/></g>` +
      `<path d="${hueco}" fill="url(#hu)"/>` + pepas +
      `<ellipse cx="50" cy="44" rx="7" ry="16" transform="rotate(-8 50 44)" fill="#fff" opacity=".25" filter="url(#bl)"/>` +
      `<path d="${piel}" fill="none" stroke="#2E4A14" stroke-opacity=".35" stroke-width=".8"/>` +
      `<path d="M64 8.5Q63 4 66 1.5" stroke="#6A7A2A" stroke-width="3" stroke-linecap="round" fill="none"/></g>`;
    return svg("papaya: partida a lo largo, pulpa salmón jugosa, el hueco rojo lleno de pepas negras y la cáscara verde amarilla.", defs, cuerpo);
  },

  palta() {
    const piel = "M64 8C76 8 82 22 86 38C92 54 106 68 104 90C102 110 86 122 64 122C42 122 26 110 24 90C22 68 36 54 42 38C46 22 52 8 64 8Z";
    const pulpa = "M64 14C74 14 79 26 82 40C88 56 100 70 98 90C96 107 82 116 64 116C46 116 32 107 30 90C28 70 40 56 46 40C49 26 54 14 64 14Z";
    const pepa = elipse(64, 84, 18, 19.5);
    const defs =
      lineal("pi", 30, 20, 100, 110, [[0, "#3E6E22"], [0.6, "#24461A"], [1, "#16300E"]]) +
      radial("pu", 64, 82, 50, [[0, "#F4EDAA"], [0.42, "#E2E48A"], [0.72, "#BCD45E"], [0.9, "#8EB83A"], [1, "#6A9A2A"]]) +
      radial("pe", 56, 74, 26, [[0, "#C68E5A"], [0.45, "#9A6234"], [0.85, "#6A3A1A"], [1, "#4A2410"]]) +
      textura("tk", { f: 0.4, s: 3, min: 0.7, semilla: 11 }) + textura("tu", { f: 0.9, s: 0.8, min: 0.9, semilla: 4 }) +
      textura("te", { f: 0.15, o: 3, s: 1.4, min: 0.8, semilla: 6 }) + desenfoque("bl", 2.4);
    const cuerpo =
      `<g filter="url(#tk)"><path d="${piel}" fill="url(#pi)"/></g>` +
      `<g filter="url(#tu)"><path d="${pulpa}" fill="url(#pu)"/></g>` +
      `<path d="${pulpa}" fill="none" stroke="#5E8E2A" stroke-width="2" stroke-opacity=".55" filter="url(#bl)"/>` +
      `<ellipse cx="65" cy="86" rx="20" ry="21.5" fill="#6A7A2A" opacity=".45" filter="url(#bl)"/>` +
      `<g filter="url(#te)"><path d="${pepa}" fill="url(#pe)"/></g>` +
      `<ellipse cx="57" cy="76" rx="6" ry="4" transform="rotate(-35 57 76)" fill="#fff" opacity=".45" filter="url(#bl)"/>` +
      `<ellipse cx="56" cy="75" rx="2" ry="1.2" transform="rotate(-35 56 75)" fill="#fff" opacity=".85"/>` +
      `<ellipse cx="50" cy="44" rx="8" ry="14" transform="rotate(20 50 44)" fill="#fff" opacity=".22" filter="url(#bl)"/>` +
      tallo([64, 9], [64, 5], [66, 2.5], 3, "#4E3A1A", "#8A7040");
    return svg("palta fuerte: partida, cáscara verde oscura y rugosa, pulpa de verde a mantequilla y su pepa café.", defs, cuerpo);
  },

  kiwi() {
    const entero = orbe({
      id: "e", d: "M44 20C66 14 84 28 84 50C84 72 66 86 46 86C26 86 14 72 14 52C14 34 24 24 44 20Z", cx: 49, cy: 52, R: 36,
      c: ["#B89468", "#9A7548", "#7A5632", "#58391E", "#3A2410"], rebote: "#B0906A", brillo: 0.15,
      textura: { f: 1.6, o: 1, s: 1.4, min: 0.75, semilla: 3 },
    });
    // La tajada: borde café peludo, pulpa verde con rayos claros, el corazón crema y la corona de pepitas negras.
    const cx = 80;
    const cy = 82;
    const az = azar(73);
    let rayos = "";
    let pepitas = "";
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + az() * 0.05;
      rayos += `M${r1(cx + Math.cos(a) * 8)} ${r1(cy + Math.sin(a) * 7)}L${r1(cx + Math.cos(a) * (24 + az() * 4))} ${r1(cy + Math.sin(a) * (23 + az() * 4))}`;
    }
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + az() * 0.08;
      const r = 11.5 + az() * 3.5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.95;
      pepitas += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="1.5" ry=".85" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(x)} ${r1(y)})"/>`;
    }
    const tajada =
      `<ellipse cx="${cx + 1.5}" cy="${cy + 3}" rx="33" ry="31.5" fill="#5A3A1E"/>` +
      `<g filter="url(#pl)"><ellipse cx="${cx}" cy="${cy}" rx="32" ry="30.5" fill="#7A5632"/></g>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="29.6" ry="28.2" fill="url(#vd)"/>` +
      `<path d="${rayos}" stroke="#E2F2A0" stroke-opacity=".38" stroke-width=".8" filter="url(#bl)"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="9" ry="8" fill="url(#cz)" filter="url(#bl)"/>` +
      `<g fill="#1A140C">${pepitas}</g>` +
      `<ellipse cx="${cx - 11}" cy="${cy - 12}" rx="12" ry="5" transform="rotate(-35 ${cx - 11} ${cy - 12})" fill="#fff" opacity=".3" filter="url(#bl)"/>` +
      `<ellipse cx="${cx - 14}" cy="${cy - 15}" rx="3" ry="1.4" transform="rotate(-35 ${cx - 14} ${cy - 15})" fill="#fff" opacity=".8"/>`;
    return svg(
      "kiwi: entero, café y peludo, y una tajada con su pulpa verde, el corazón crema y las pepitas negras.",
      entero.defs + radial("vd", cx, cy, 30, [[0, "#D8EC88"], [0.35, "#A8D44A"], [0.85, "#78B42A"], [1, "#5E9A20"]]) +
        radial("cz", cx, cy, 9, [[0, "#FAF6DA"], [1, "#E6EEB0"]]) + desenfoque("bl", 0.7) +
        `<filter id="pl" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" seed="2"/><feDisplacementMap in="SourceGraphic" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter>`,
      `<g filter="url(#pl)">${entero.cuerpo}</g>` + tajada,
    );
  },

  chirimoya() {
    const d = "M62 22C90 20 110 46 106 78C102 104 84 120 63 120C42 120 24 104 21 78C18 46 36 24 62 22Z";
    // Las aréolas: escamas en forma de U, cada una con su relieve, que dan la vuelta a la fruta.
    let escamas = "";
    for (let fila = 0; fila < 9; fila++) {
      const y = 30 + fila * 10.5;
      const t = (y - 72) / 50;
      const ancho = 43 * Math.sqrt(Math.max(0, 1 - t * t));
      for (let k = -5; k <= 5; k++) {
        const th = (k + (fila % 2) * 0.5) * 0.3;
        if (Math.abs(th) > 1.42) continue;
        const x = 64 + ancho * Math.sin(th);
        const w = ancho * 0.3 * Math.cos(th) + 0.8;
        escamas += `<path d="M${r1(x - w / 2)} ${r1(y - 3.5)}Q${r1(x)} ${r1(y + 7)} ${r1(x + w / 2)} ${r1(y - 3.5)}"/>` +
          `<ellipse cx="${r1(x - w * 0.08)}" cy="${r1(y - 1)}" rx="${r1(w * 0.28)}" ry="2.4" fill="#E2F0A8" stroke="none" opacity=".28"/>`;
      }
    }
    const o = orbe({
      id: "q", d, cx: 63, cy: 72, R: 47, c: ["#D6E68E", "#AECB5E", "#82AA3E", "#58822A", "#36581A"], rebote: "#C8DE8A", brillo: 0.35,
      textura: { f: 0.5, s: 1, min: 0.88, semilla: 41 },
      capas: `<g fill="none" stroke="#2E4E16" stroke-opacity=".55" stroke-width="1.1">${escamas}</g>`,
    });
    return svg(
      "chirimoya: verde, en forma de corazón, con su cáscara de escamas en U, como huellas de dedo.",
      o.defs,
      o.cuerpo + tallo([62, 23], [60, 15], [63, 9], 3.4, "#5A4A22", "#9A8A5A"),
    );
  },
};
