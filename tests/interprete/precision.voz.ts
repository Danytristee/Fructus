// /voz-precision: corre los casos de tests/interprete/casos.json contra el modelo real, con el mismo
// lib/voz/interprete.ts que usa /api/voz, y escribe el informe en docs/voz/precision-AAAA-MM-DD.md.
// Uso: pnpm voz:precision                       (modelos por defecto)
//      VOZ_MODELOS=openai/gpt-oss-20b pnpm voz:precision
//      VOZ_MODELOS=claude-haiku-5-5 pnpm voz:precision     (Claude, con ANTHROPIC_API_KEY)
//      VOZ_CASOS=<otro.json> VOZ_INFORMES=<carpeta> pnpm voz:precision   (pruebas sueltas, sin tocar docs/voz)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { expect, test } from "vitest";

import type { Catalogo } from "../../lib/voz/catalogo-reglas";
import type { FaltaPreguntada, OperacionActual } from "../../lib/voz/esquemas";
import { interpretar } from "../../lib/voz/interprete";
import { camposPrudentes, diferencias, inventos, percentil } from "../../lib/voz/precision-reglas";

// `correccionDe`: la operación que Fructus leyó en voz alta, en los campos de su herramienta (`operacion`: venta si no se dice);
// `transcripcion` es lo que la persona respondió para corregirla (ADR-0020). Con `falta`, la operación estaba incompleta y Fructus
// preguntó ese dato: la transcripción es la respuesta (ADR-0027).
type Caso = {
  id: string;
  transcripcion: string;
  operacion?: OperacionActual["operacion"];
  correccionDe?: OperacionActual["datos"];
  falta?: FaltaPreguntada;
  esperado: { herramienta: string; datos: Record<string, unknown> };
};
type Fila = { id: string; intencion: boolean; datos: boolean; inventos: string[]; fallos: string[]; obtenido: string; dudas: string[]; ms: number };

const archivo = JSON.parse(readFileSync(process.env.VOZ_CASOS ?? "tests/interprete/casos.json", "utf8")) as { catalogo?: Catalogo; casos: Caso[] };
const { casos, catalogo } = archivo;
const carpeta = process.env.VOZ_INFORMES ?? "docs/voz";
const modelos = (process.env.VOZ_MODELOS ?? "openai/gpt-oss-120b,openai/gpt-oss-20b").split(",").map((m) => m.trim());
const espera = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
const pct = (n: number, d: number) => (d === 0 ? "—" : `${((100 * n) / d).toFixed(1)} %`);

async function medir(modelo: string) {
  const filas: Fila[] = [];
  for (const caso of casos) {
    const correccionDe = caso.correccionDe ? ({ operacion: caso.operacion ?? "venta", datos: caso.correccionDe } as OperacionActual) : undefined;
    // Cada modelo se mide solo contra su servicio: Claude contra Anthropic, Gemini contra Google y cualquier otro contra Groq.
    if (modelo.startsWith("gemini-")) process.env.GEMINI_MODELO_LLM = modelo;
    const opciones = modelo.startsWith("claude-")
      ? { catalogo, modeloClaude: modelo, solo: "anthropic" as const, correccionDe, falta: caso.falta }
      : modelo.startsWith("gemini-")
        ? { catalogo, solo: "gemini" as const, correccionDe, falta: caso.falta }
        : { catalogo, modeloGroq: modelo, solo: "groq" as const, correccionDe, falta: caso.falta };
    let r = await interpretar(caso.transcripcion, opciones);
    // Plan gratuito: una llamada a la vez; si Groq pide esperar, se espera y se reintenta (hasta 3 veces).
    for (let i = 0; i < 3 && !r.ok && r.intentos.some((x) => x.error.includes("429") || x.error.includes("503")); i++) {
      await espera(8_000 * (i + 1));
      r = await interpretar(caso.transcripcion, opciones);
    }
    if (!r.ok) {
      filas.push({ id: caso.id, intencion: false, datos: false, inventos: [], fallos: [r.intentos.map((x) => x.error).join(" · ").slice(0, 140)], obtenido: "(sin respuesta)", dudas: [], ms: r.latenciaMs });
      continue;
    }
    const { herramienta, datos } = r.interpretacion;
    const intencion = herramienta === caso.esperado.herramienta;
    const fallos = intencion ? diferencias(caso.esperado.datos, datos) : [`herramienta: esperaba ${caso.esperado.herramienta}, vino ${herramienta}`];
    filas.push({
      id: caso.id,
      intencion,
      datos: intencion && fallos.length === 0,
      inventos: intencion ? inventos(caso.esperado.datos, datos) : [],
      fallos,
      obtenido: `${herramienta} ${JSON.stringify(datos)}`,
      dudas: "dudas" in datos && Array.isArray(datos.dudas) ? datos.dudas : [],
      ms: r.latenciaMs,
    });
  }
  const conPrudencia = casos.reduce((n, c) => n + camposPrudentes(c.esperado.datos), 0);
  const inventados = filas.reduce((n, f) => n + f.inventos.length, 0);
  return {
    modelo,
    filas,
    intencion: filas.filter((f) => f.intencion).length,
    datos: filas.filter((f) => f.datos).length,
    prudencia: { campos: conPrudencia, inventados },
    p50: percentil(filas.map((f) => f.ms), 50),
    p95: percentil(filas.map((f) => f.ms), 95),
  };
}

test("precisión del intérprete contra el modelo real", async () => {
  if (modelos.some((m) => !m.startsWith("claude-") && !m.startsWith("gemini-"))) expect(process.env.GROQ_API_KEY, "Falta GROQ_API_KEY en .env.local").toBeTruthy();
  if (modelos.some((m) => m.startsWith("gemini-"))) expect(process.env.GEMINI_API_KEY, "Falta GEMINI_API_KEY en .env.local").toBeTruthy();
  if (modelos.some((m) => m.startsWith("claude-"))) expect(process.env.ANTHROPIC_API_KEY, "Falta ANTHROPIC_API_KEY en .env.local").toBeTruthy();
  const resultados = [];
  for (const m of modelos) resultados.push(await medir(m));

  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  let ruta = `${carpeta}/precision-${hoy}.md`;
  for (let n = 2; existsSync(ruta); n++) ruta = `${carpeta}/precision-${hoy}-${n}.md`;

  const total = casos.length;
  const lineas = [
    `# /voz-precision · ${hoy}`,
    "",
    `**Casos:** ${total} (\`tests/interprete/casos.json\`). **Proveedor:** Groq, Anthropic o Google según el modelo, sin respaldo (para comparar modelos limpio). **Catálogo en el prompt:** ${catalogo ? "sí (el de seed.sql)" : "no"}. **Medido:** solo el intérprete (texto → herramienta); la voz a texto se mide aparte.`,
    "",
    "| Modelo | Intención (meta ≥ 95 %) | Datos clave (meta ≥ 90 %) | Prudencia con el dinero (meta 100 %) | Latencia p50 | p95 |",
    "|---|---|---|---|---|---|",
    ...resultados.map(
      (r) =>
        `| \`${r.modelo}\` | ${pct(r.intencion, total)} (${r.intencion}/${total}) | ${pct(r.datos, total)} (${r.datos}/${total}) | ${pct(r.prudencia.campos - r.prudencia.inventados, r.prudencia.campos)} (${r.prudencia.inventados} invento(s) en ${r.prudencia.campos} campos) | ${r.p50} ms | ${r.p95} ms |`,
    ),
    "",
  ];
  for (const r of resultados) {
    const malos = r.filas.filter((f) => !f.datos || f.inventos.length);
    lineas.push(`## \`${r.modelo}\`: casos que fallan (${malos.length})`, "");
    if (malos.length === 0) lineas.push("Ninguno.", "");
    for (const f of malos) {
      lineas.push(`- **${f.id}** (${f.ms} ms)${f.inventos.length ? ` · **INVENTÓ:** ${f.inventos.join(", ")}` : ""}`);
      for (const x of f.fallos) lineas.push(`  - ${x}`);
      lineas.push(`  - vino: \`${f.obtenido.slice(0, 220)}\``);
    }
    lineas.push("");
    // Las dudas salen tal cual en la tarjeta: se leen aquí para ver si suenan a puesto o a formulario.
    const conDudas = r.filas.flatMap((f) => (f.dudas.length ? [`- **${f.id}:** ${f.dudas.map((d) => `«${d}»`).join(" · ")}`] : []));
    lineas.push(`### Dudas que salieron (${conDudas.length} de ${r.filas.length} casos)`, "", ...(conDudas.length ? conDudas : ["Ninguna."]), "");
  }
  writeFileSync(ruta, lineas.join("\n"));
  console.log(`\nInforme: ${ruta}\n${lineas.slice(4, 6 + resultados.length).join("\n")}`);
});
