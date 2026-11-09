// Saca los íconos de la app (PWA) de la imagen del logo aprobado (ADR-0014) y los guarda como PNG. Se corre una vez, o cuando cambie el logo:
//   pnpm iconos
//
// El problema: cada sistema recorta el ícono a su manera. iPhone redondea las esquinas solo y pinta de negro lo transparente; Android recorta
// los «maskable» con la forma de su pantalla de inicio (círculo, gota, cuadrado) y solo garantiza el círculo del 80 % del centro; Chrome y el
// escritorio usan el ícono tal cual. Mal hecho: el mismo PNG para todos, y en Android la hoja de la F queda cortada.
//
// Por eso salen tres formas, todas recortadas de docs/marca/logo-fructus.webp (no se redibuja nada: el dibujo, sus luces y sombras son los
// de la imagen aprobada):
//   redondeada   el ícono con sus esquinas transparentes       public/icons/icon-192.png, icon-512.png, app/icon.png, app/favicon.ico
//   a sangre     el interior liso estirado hasta las esquinas  app/apple-icon.png (iPhone redondea solo)
//   maskable     igual, con la marca dentro del círculo        public/icons/icon-maskable-192.png, -512.png (Android)
//
// Usa el Chromium de Playwright para recortar en un <canvas>.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(`${raiz}/`)("@playwright/test");
const logo = `data:image/webp;base64,${readFileSync(join(raiz, "docs/marca/logo-fructus.webp")).toString("base64")}`;

// Dónde está el ícono dentro de la imagen (medido sobre ella, 1254 × 1254 px): un cuadrado de 818 px con esquinas de ~206 px de radio.
// El interior (sin el bisel del borde redondeado) es donde el fondo verde es liso y la marca entra entera.
const medidas = { X: 216, Y: 150, L: 818, R: 206, IX: 300, IY: 205, IW: 650, IH: 712 };

const salidas = [
  // [archivo, lado, forma]
  ["public/icons/icon-192.png", 192, "redondeada"],
  ["public/icons/icon-512.png", 512, "redondeada"],
  ["public/icons/icon-maskable-192.png", 192, "maskable"],
  ["public/icons/icon-maskable-512.png", 512, "maskable"],
  ["app/apple-icon.png", 180, "sangre"],
  ["app/icon.png", 96, "redondeada"],
  ["favicon", 64, "redondeada"],
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.setContent(`<img src="${logo}">`);
const pngs = await pagina.evaluate(
  async ({ m, salidas }) => {
    const img = document.querySelector("img");
    await img.decode();
    const lienzo = (ancho, alto = ancho) => {
      const c = document.createElement("canvas");
      c.width = ancho;
      c.height = alto;
      return [c, c.getContext("2d")];
    };
    const [interior, ix] = lienzo(m.IW, m.IH);
    ix.drawImage(img, m.IX, m.IY, m.IW, m.IH, 0, 0, m.IW, m.IH);

    // A sangre: el fondo es solo color (las cuatro esquinas lisas del interior, mezcladas en bilineal) y encima va el interior nítido, con el
    // borde fundido para que no se note la costura. `escala`: cuánto se agranda el interior; `fundido`: qué parte del ancho se funde.
    const promedio = (i, j) => {
      const d = ix.getImageData(i, j, 15, 15).data;
      const t = [0, 0, 0];
      for (let k = 0; k < d.length; k += 4) for (let c = 0; c < 3; c++) t[c] += d[k + c];
      return t.map((v) => v / 225);
    };
    const esquinas = [promedio(8, 8), promedio(m.IW - 23, 8), promedio(8, m.IH - 23), promedio(m.IW - 23, m.IH - 23)];
    const aSangre = (n, escala, fundido) => {
      const [dos, dx] = lienzo(2);
      const datos = dx.createImageData(2, 2);
      esquinas.forEach((e, k) => datos.data.set([...e, 255], k * 4));
      dx.putImageData(datos, 0, 0);
      const [c, x] = lienzo(n);
      x.imageSmoothingQuality = "high";
      x.drawImage(dos, 0.5, 0.5, 1, 1, 0, 0, n, n);
      const w = m.IW * escala, h = m.IH * escala, ox = (n - w) / 2, oy = (n - h) / 2, borde = w * fundido;
      const [f, fx] = lienzo(n);
      fx.drawImage(interior, ox, oy, w, h);
      fx.globalCompositeOperation = "destination-in";
      fx.filter = `blur(${Math.round(borde * 0.6)}px)`;
      fx.fillRect(ox + borde, oy + borde, w - 2 * borde, h - 2 * borde);
      x.drawImage(f, 0, 0);
      return c;
    };
    const [redondeada, rx] = lienzo(m.L);
    rx.drawImage(img, m.X, m.Y, m.L, m.L, 0, 0, m.L, m.L);
    rx.globalCompositeOperation = "destination-in";
    rx.beginPath();
    rx.roundRect(3, 3, m.L - 6, m.L - 6, m.R - 2);
    rx.fill();

    const formas = {
      redondeada,
      // iPhone: la marca del mismo tamaño que en la imagen aprobada.
      sangre: aSangre(1024, 1024 / m.L, 0.035),
      // Android: la marca entra en el círculo del 80 % (la punta de la hoja es lo más lejano del centro).
      maskable: aSangre(1024, 1.05, 0.085),
    };
    return salidas.map(([, lado, forma]) => {
      const [c, x] = lienzo(lado);
      x.imageSmoothingQuality = "high";
      x.drawImage(formas[forma], 0, 0, lado, lado);
      return c.toDataURL("image/png").split(",")[1];
    });
  },
  { m: medidas, salidas },
);
await navegador.close();

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

salidas.forEach(([ruta, lado], i) => {
  const png = Buffer.from(pngs[i], "base64");
  if (ruta === "favicon") writeFileSync(join(raiz, "app/favicon.ico"), ico(png, lado));
  else writeFileSync(join(raiz, ruta), png);
  console.log("listo", ruta === "favicon" ? "app/favicon.ico" : ruta);
});
