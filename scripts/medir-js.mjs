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
  // Los scripts `nomodule` son los polyfills de navegadores viejos: el HTML los trae, pero cualquier Android con Chrome 60 o más (todos los
  // de hoy) NO los descarga. Se miden aparte para no contar en el presupuesto lo que ningún teléfono real baja.
  const etiquetas = [...html.matchAll(/<script\b[^>]*\bsrc="\/_next\/(static\/[^"]+\.js)"[^>]*>/g)];
  const scripts = [...new Set(etiquetas.filter((m) => !/\bnomodule\b/i.test(m[0])).map((m) => m[1]))];
  const viejos = [...new Set(etiquetas.filter((m) => /\bnomodule\b/i.test(m[0])).map((m) => m[1]))];
  const medir = (lista) => lista.reduce((suma, s) => suma + brotliCompressSync(readFileSync(join(".next", s))).length, 0) / 1024;
  const kb = medir(scripts);
  const kbViejos = medir(viejos);
  console.log(`${ruta}: ${scripts.length} scripts, ${kb.toFixed(1)} KB brotli que baja un teléfono (tope ${tope} KB)`);
  if (viejos.length) console.log(`  (más ${kbViejos.toFixed(1)} KB de polyfills nomodule que solo bajan navegadores de hace una década: ${(kb + kbViejos).toFixed(1)} KB con ellos)`);
  terminar(kb > tope ? 1 : 0);
} catch (error) {
  console.error("medir-js:", error instanceof Error ? error.message : error);
  terminar(1);
}
