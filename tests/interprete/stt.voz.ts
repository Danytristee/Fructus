// /voz-precision, parte voz a texto: frases del puesto dichas por la voz en español del Mac (`say`), transcritas con el
// mismo lib/voz/stt.ts que usa /api/voz, con y sin el vocabulario del puesto. Escribe docs/voz/stt-AAAA-MM-DD.md.
// Es una aproximación: una voz sintética sin ruido de mercado. Los audios reales del puesto la reemplazan (guion en audios/).
// Uso: pnpm voz:stt
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { vocabularioWhisper, type Catalogo } from "../../lib/voz/catalogo-reglas";
import { errorPorPalabras, percentil } from "../../lib/voz/precision-reglas";
import { transcribir } from "../../lib/voz/stt";

// Se escriben como las escribiría Whisper (números en cifras); la voz del Mac los lee en palabras.
const frases = [
  { id: "venta-manzana-yape", texto: "Vendí 10 cajas de manzana royal a don Lucho a 128, me yapeó" },
  { id: "venta-pera-credito", texto: "12 de pera gaucho para Santa Ana, lo debe" },
  { id: "venta-kiwi-transferencia", texto: "5 de kiwi cope al Mochica a 140, por transferencia" },
  { id: "abono-rosa", texto: "La señora Rosa me abonó 200 en efectivo" },
  { id: "compra-uva-chao", texto: "Llegaron 40 cajas de uva bolón del de Chao a 130" },
  { id: "merma-platano", texto: "Se malograron 2 cajas de plátano biscocho" },
  { id: "gasto-flete", texto: "Pagué 120 de flete" },
  { id: "consulta-flaco", texto: "¿Cuánto me debe el flaco?" },
  { id: "venta-granadilla-plin", texto: "15 de granadilla a la juguería, me plineó" },
  { id: "venta-nispero-anotalo", texto: "8 de níspero a don Lucho, anótalo" },
];

const catalogo = JSON.parse(readFileSync("tests/interprete/catalogo.json", "utf8")) as Catalogo;
const carpetaAudios = join(tmpdir(), "fructus-stt");
const voz = process.env.VOZ_SAY ?? "Paulina";

function audio(id: string, texto: string): Blob {
  mkdirSync(carpetaAudios, { recursive: true });
  const ruta = join(carpetaAudios, `${id}-${voz}.m4a`);
  if (!existsSync(ruta)) execFileSync("say", ["-v", voz, "-o", ruta, "--file-format=m4af", "--data-format=aac", texto]);
  return new Blob([readFileSync(ruta)], { type: "audio/mp4" });
}

test("voz a texto con y sin el vocabulario del puesto", async () => {
  expect(process.env.GROQ_API_KEY, "Falta GROQ_API_KEY en .env.local").toBeTruthy();
  const vocabulario = vocabularioWhisper(catalogo);
  const filas: { id: string; dicho: string; sin: string; con: string; werSin: number; werCon: number; ms: number }[] = [];
  for (const f of frases) {
    const a = audio(f.id, f.texto);
    const sin = await transcribir(a, { soloGroq: true });
    const con = await transcribir(a, { vocabulario, soloGroq: true });
    const textoSin = sin.ok ? sin.texto : `(falló: ${sin.intentos.map((x) => x.error).join(" · ")})`;
    const textoCon = con.ok ? con.texto : `(falló: ${con.intentos.map((x) => x.error).join(" · ")})`;
    filas.push({ id: f.id, dicho: f.texto, sin: textoSin, con: textoCon, werSin: errorPorPalabras(f.texto, textoSin), werCon: errorPorPalabras(f.texto, textoCon), ms: con.latenciaMs });
  }
  const promedio = (xs: number[]) => (100 * xs.reduce((s, x) => s + x, 0)) / xs.length;
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  let ruta = `docs/voz/stt-${hoy}.md`;
  for (let n = 2; existsSync(ruta); n++) ruta = `docs/voz/stt-${hoy}-${n}.md`;
  const lineas = [
    `# Voz a texto · ${hoy}`,
    "",
    `**Modelo:** \`${process.env.GROQ_MODELO_STT ?? "whisper-large-v3-turbo"}\` en Groq. **Audios:** ${frases.length} frases del puesto dichas por la voz «${voz}» del Mac (español de México, sin ruido).`,
    "Es una aproximación: los audios reales del puesto, con ruido y acento trujillano, la reemplazan.",
    "",
    "| | Error por palabras (menos es mejor) | Frases sin ningún error | Latencia p50 | p95 |",
    "|---|---|---|---|---|",
    `| Sin vocabulario | ${promedio(filas.map((f) => f.werSin)).toFixed(1)} % | ${filas.filter((f) => f.werSin === 0).length}/${filas.length} | | |`,
    `| **Con el vocabulario del puesto** | **${promedio(filas.map((f) => f.werCon)).toFixed(1)} %** | ${filas.filter((f) => f.werCon === 0).length}/${filas.length} | ${percentil(filas.map((f) => f.ms), 50)} ms | ${percentil(filas.map((f) => f.ms), 95)} ms |`,
    "",
    "## Frase por frase",
    "",
    "| Caso | Dicho | Sin vocabulario | Con vocabulario |",
    "|---|---|---|---|",
    ...filas.map((f) => `| ${f.id} | ${f.dicho} | ${f.sin} (${(100 * f.werSin).toFixed(0)} %) | ${f.con} (${(100 * f.werCon).toFixed(0)} %) |`),
    "",
    `**Vocabulario usado** (${vocabulario.length} caracteres):`,
    "",
    `> ${vocabulario}`,
    "",
  ];
  writeFileSync(ruta, lineas.join("\n"));
  console.log(`\nInforme: ${ruta}\n${lineas.slice(5, 9).join("\n")}`);
});
