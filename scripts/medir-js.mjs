// Mide el JavaScript que descarga el celular en una ruta, comprimido con brotli
// como lo sirve Vercel, y falla si pasa el presupuesto (ADR-0006).
//
// Uso:  pnpm build && pnpm medir:js [ruta] [tope-en-KB]
//       pnpm medir:js / 180
// Con sesión (rutas de (app)): MEDIR_COOKIE="sb-…=…" pnpm medir:js / 180
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";

const ruta = process.argv[2] ?? "/";
const tope = Number(process.argv[3] ?? 180);
const puerto = 3199;

const servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(puerto)], { stdio: "ignore" });
const terminar = (codigo) => {
  servidor.kill();
  process.exit(codigo);
};

async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://127.0.0.1:${puerto}/`, { redirect: "manual", signal: AbortSignal.timeout(1000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("next start no respondió en 30 s (¿corriste pnpm build?)");
}

try {
  await esperarServidor();
  const respuesta = await fetch(`http://127.0.0.1:${puerto}${ruta}`, {
    redirect: "manual",
    headers: process.env.MEDIR_COOKIE ? { cookie: process.env.MEDIR_COOKIE } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (respuesta.status >= 300 && respuesta.status < 400) {
    console.error(`${ruta} redirige a ${respuesta.headers.get("location")}: falta sesión (MEDIR_COOKIE).`);
    terminar(1);
  }
  const html = await respuesta.text();
  const scripts = [...new Set([...html.matchAll(/src="\/_next\/(static\/[^"]+\.js)"/g)].map((m) => m[1]))];
  let total = 0;
  for (const s of scripts) total += brotliCompressSync(readFileSync(join(".next", s))).length;
  const kb = total / 1024;
  console.log(`${ruta}: ${scripts.length} scripts, ${kb.toFixed(1)} KB brotli (tope ${tope} KB)`);
  terminar(kb > tope ? 1 : 0);
} catch (error) {
  console.error("medir-js:", error instanceof Error ? error.message : error);
  terminar(1);
}
