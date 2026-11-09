// Genera los íconos de la PWA recortando la imagen aprobada (referencia-logo.webp). Necesita el servidor de maquetas en 127.0.0.1:4321.
// Uso, desde la raíz del repo: node docs/maquetas/bosque/logo/generar-iconos.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const out = "docs/maquetas/bosque/logo";
const b = await chromium.launch(); const p = await b.newPage();
await p.goto("http://127.0.0.1:4321/docs/maquetas/bosque/logo/referencia-logo.webp");
const archivos = await p.evaluate(async () => {
  const img = document.querySelector("img"); await img.decode();
  // El ícono dentro de la imagen original (medido): 818 px de lado, esquina de radio ~211 px.
  const X = 216, Y = 150, L = 818, R = 206;
  const lienzo = (n) => { const c = document.createElement("canvas"); c.width = c.height = n; return [c, c.getContext("2d")]; };
  const redondeado = (x, a, b, w, r) => { x.beginPath(); x.roundRect(a, b, w, w, r); };
  // El interior del ícono, lejos del bisel de su borde redondeado: el fondo ahí es liso y la marca entra entera.
  const IX = 300, IY = 205, IW = 650, IH = 712, IL = IW;
  const cr = document.createElement("canvas"); cr.width = IW; cr.height = IH; const crx = cr.getContext("2d"); crx.drawImage(img, IX, IY, IW, IH, 0, 0, IW, IH);
  // A sangre: el mismo interior estirado y muy difuminado hace de fondo; encima, el interior nítido con el borde fundido.
  const sangre = (n, escala, fundido = 0.035) => {
    // Fondo: solo color, mezclado en bilineal desde las cuatro esquinas lisas del interior (promedio de un bloque de 15 px).
    const prom = (i, j) => { const d = crx.getImageData(i, j, 15, 15).data; const t = [0, 0, 0]; for (let k = 0; k < d.length; k += 4) { t[0] += d[k]; t[1] += d[k + 1]; t[2] += d[k + 2]; } return t.map((v) => v / 225); };
    const esq = [prom(8, 8), prom(IW - 23, 8), prom(8, IH - 23), prom(IW - 23, IH - 23)];
    const [c2, x2] = lienzo(2); const dd = x2.createImageData(2, 2); esq.forEach((e, k) => dd.data.set([...e, 255], k * 4)); x2.putImageData(dd, 0, 0);
    const [c, x] = lienzo(n); x.imageSmoothingQuality = "high"; x.drawImage(c2, 0.5, 0.5, 1, 1, 0, 0, n, n);
    const w = IW * escala, h = IH * escala, ox = (n - w) / 2, oy = (n - h) / 2;
    const [f, fx] = lienzo(n); fx.drawImage(cr, ox, oy, w, h);
    const borde = w * fundido;
    fx.globalCompositeOperation = "destination-in"; fx.filter = "blur(" + Math.round(borde * 0.6) + "px)"; fx.fillStyle = "#000"; fx.fillRect(ox + borde, oy + borde, w - 2 * borde, h - 2 * borde);
    x.drawImage(f, 0, 0); return c;
  };
  const [limpio, lx] = lienzo(L); lx.drawImage(img, X, Y, L, L, 0, 0, L, L);
  lx.globalCompositeOperation = "destination-in"; redondeado(lx, 3, 3, L - 6, R - 2); lx.fill();
  const sale = {};
  const guardar = (nombre, fuente, n) => { const [c, x] = lienzo(n); x.imageSmoothingQuality = "high"; x.drawImage(fuente, 0, 0, n, n); sale[nombre] = c.toDataURL("image/png"); };
  // 1) Cuadrado a sangre (iPhone recorta las esquinas solo): la marca del mismo tamaño que en tu ícono.
  const ios = sangre(1024, 1024 / L);
  // 2) Maskable (Android lo recorta en círculo u otra forma): la marca entra en el círculo del 80 %.
  const mk = sangre(1024, 1.05, 0.085);
  // 3) Redondeado con esquinas transparentes (escritorio, pestañas, la maqueta).
  guardar("icono-ios-1024.png", ios, 1024); guardar("icono-ios-180.png", ios, 180);
  guardar("icono-maskable-1024.png", mk, 1024); guardar("icono-maskable-512.png", mk, 512); guardar("icono-maskable-192.png", mk, 192);
  guardar("icono-1024.png", limpio, 1024); guardar("icono-512.png", limpio, 512); guardar("icono-192.png", limpio, 192); guardar("icono-96.png", limpio, 96);
  guardar("favicon-32.png", ios, 32); guardar("favicon-16.png", ios, 16);
  return sale;
});
for (const [n, d] of Object.entries(archivos)) writeFileSync(`${out}/${n}`, Buffer.from(d.split(",")[1], "base64"));
console.log(Object.keys(archivos).join(" ")); await b.close();
