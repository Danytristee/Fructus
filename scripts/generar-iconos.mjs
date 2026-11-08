// Dibuja los íconos de la app (el orbe de voz de Aurora, ADR-0007) y los guarda como PNG. Se corre una vez, o cuando cambie la identidad:
//   node scripts/generar-iconos.mjs
// Usa el Chromium de Playwright para pintar el orbe (el degradado cónico no existe en SVG). Los colores son los de app/globals.css.
//
// Qué sale y para qué:
//   public/icons/icon-192.png, icon-512.png            «any»: esquinas redondas, para el instalador de Chrome, Edge y Samsung Internet
//   public/icons/icon-maskable-192.png, -512.png        «maskable»: a sangre, para que Android lo recorte con la forma de su launcher
//   app/apple-icon.png (180)                            iPhone y iPad: a sangre (iOS redondea solo y pinta de negro lo transparente)
//   app/icon.png (96) y app/favicon.ico (64)            la pestaña del navegador (chicos: se piden en cada primera visita)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(`${raiz}/`)("@playwright/test");

// El micrófono de lucide (el mismo icono del orbe en la app).
const microfono = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>`;

/** El ícono a `tam` px. `aSangre`: el fondo llega a las esquinas. Si no, las esquinas son redondas y transparentes. */
function html(tam, aSangre) {
  const orbe = Math.round(tam * 0.54);
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent}
    .icono{position:relative;width:${tam}px;height:${tam}px;overflow:hidden;
      border-radius:${aSangre ? 0 : Math.round(tam * 0.225)}px;
      background:
        radial-gradient(circle at 10% 8%, #9fe8d0 0%, transparent 58%),
        radial-gradient(circle at 96% 12%, #b9d8ff 0%, transparent 58%),
        radial-gradient(circle at 8% 96%, #ffd3b5 0%, transparent 58%),
        radial-gradient(circle at 96% 94%, #e2d4ff 0%, transparent 58%),
        #eef3f8}
    .orbe{position:absolute;left:50%;top:50%;width:${orbe}px;height:${orbe}px;margin:${-orbe / 2}px 0 0 ${-orbe / 2}px;border-radius:50%;
      background:conic-gradient(from 25deg,#114b5f,#2e6fa8,#5b4fc4,#1f7a8c,#114b5f);
      box-shadow:0 ${tam * 0.028}px ${tam * 0.085}px rgba(17,75,95,.45),inset 0 ${Math.max(1, tam * 0.004)}px 0 rgba(255,255,255,.25);
      display:grid;place-items:center}
    .orbe::before{content:"";position:absolute;top:${orbe * 0.1}px;right:${orbe * 0.17}px;width:${orbe * 0.33}px;height:${orbe * 0.21}px;border-radius:50%;
      background:rgba(255,255,255,.35);filter:blur(${Math.max(1, orbe * 0.04)}px)}
    .orbe svg{width:${Math.round(orbe * 0.46)}px;height:${Math.round(orbe * 0.46)}px;position:relative}
  </style><div class="icono"><div class="orbe">${microfono}</div></div>`;
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

async function pintar(tam, aSangre) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(html(tam, aSangre));
  return pagina.screenshot({ omitBackground: !aSangre, clip: { x: 0, y: 0, width: tam, height: tam } });
}

function ico(png, lado) {
  // Un .ico puede llevar el PNG tal cual: una cabecera de 6 bytes, una entrada de 16 y la imagen.
  const cab = Buffer.alloc(22);
  cab.writeUInt16LE(0, 0); // reservado
  cab.writeUInt16LE(1, 2); // tipo: ícono
  cab.writeUInt16LE(1, 4); // una imagen
  cab.writeUInt8(lado, 6); // ancho
  cab.writeUInt8(lado, 7); // alto
  cab.writeUInt16LE(1, 10); // planos
  cab.writeUInt16LE(32, 12); // bits por píxel
  cab.writeUInt32LE(png.length, 14); // tamaño de la imagen
  cab.writeUInt32LE(22, 18); // dónde empieza
  return Buffer.concat([cab, png]);
}

mkdirSync(join(raiz, "public/icons"), { recursive: true });
const salidas = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-maskable-192.png", 192, true],
  ["public/icons/icon-maskable-512.png", 512, true],
  ["app/apple-icon.png", 180, true],
  ["app/icon.png", 96, false],
];
for (const [ruta, tam, aSangre] of salidas) {
  writeFileSync(join(raiz, ruta), await pintar(tam, aSangre));
  console.log("listo", ruta);
}
writeFileSync(join(raiz, "app/favicon.ico"), ico(await pintar(64, false), 64));
console.log("listo app/favicon.ico");
await navegador.close();
