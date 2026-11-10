// Dibuja las frutas de public/frutas/ (ADR-0014). Se corre con `pnpm frutas` y el resultado se revisa a ojo: `pnpm frutas --hoja`
// deja una hoja de muestra en docs/maquetas/frutas/hoja.html con cada fruta a 128, 44 y 28 px.
import { mkdirSync, writeFileSync } from "node:fs";

import { compuestas } from "./compuestas.mjs";
import { redondas } from "./redondas.mjs";

const todas = { ...redondas, ...compuestas };
const solo = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const destino = new URL("../../public/frutas/", import.meta.url);
mkdirSync(destino, { recursive: true });
for (const [nombre, dibujar] of Object.entries(todas)) {
  if (solo.length && !solo.includes(nombre)) continue;
  writeFileSync(new URL(`${nombre}.svg`, destino), dibujar());
}
if (process.argv.includes("--hoja")) {
  const celdas = Object.keys(todas)
    .sort()
    .map((n) => `<figure><img src="../../../public/frutas/${n}.svg" width="128" height="128" alt=""><div><img src="../../../public/frutas/${n}.svg" width="44" alt=""><img src="../../../public/frutas/${n}.svg" width="28" alt=""></div><figcaption>${n}</figcaption></figure>`)
    .join("");
  writeFileSync(
    new URL("../../docs/maquetas/frutas/hoja.html", import.meta.url),
    `<!doctype html><meta charset="utf-8"><title>Frutas de Fructus</title><style>body{margin:0;padding:16px;background:#F7F5EE;font:14px system-ui;color:#163A27;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}figure{margin:0;text-align:center}img{filter:drop-shadow(0 2px 3px rgb(0 0 0/.14))}figure div{display:flex;justify-content:center;align-items:center;gap:8px}</style>${celdas}`,
  );
}
console.log(`${Object.keys(todas).length} frutas dibujadas en public/frutas/`);
