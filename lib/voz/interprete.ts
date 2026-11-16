import "server-only";

// Lo que dijo la persona (ya en texto) → una herramienta con sus datos, validada con Zod.
// Groq primero; si no responde en 8 s o falla, Gemini (si hay clave). Ninguno inventa: si la respuesta no calza con el
// esquema, no se usa. La transcripción nunca va a los logs (CLAUDE.md, «Seguridad y claves»).
import { fetchWithTimeout } from "../supabase/fetch-con-tope";
import { bloqueCatalogo, type Catalogo } from "./catalogo-reglas";
import { herramientasParaElModelo, leerInterpretacion, type Interpretacion } from "./esquemas";
import { PROMPT_SISTEMA, mensajeCorreccion } from "./prompt";

type Proveedor = { nombre: "groq" | "gemini"; url: string; clave: string | undefined; modelo: string; extra: Record<string, unknown> };

function proveedores(modeloGroq?: string): Proveedor[] {
  return [
    {
      nombre: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      clave: process.env.GROQ_API_KEY,
      modelo: modeloGroq ?? process.env.GROQ_MODELO_LLM ?? "openai/gpt-oss-120b",
      // Los gpt-oss razonan antes de responder: «low» basta para elegir una herramienta y cuida la latencia.
      extra: { reasoning_effort: "low" },
    },
    {
      nombre: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      clave: process.env.GEMINI_API_KEY,
      modelo: process.env.GEMINI_MODELO_LLM ?? "gemini-2.5-flash",
      extra: {},
    },
  ];
}

type Intento = { modelo: string; error: string };

export type ResultadoInterprete =
  | { ok: true; interpretacion: Interpretacion; modelo: string; latenciaMs: number; intentos: Intento[] }
  | { ok: false; motivo: string; latenciaMs: number; intentos: Intento[] };

type RespuestaChat = { choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };

async function preguntar(p: Proveedor, sistema: string, transcripcion: string): Promise<{ ok: true; interpretacion: Interpretacion } | { ok: false; error: string }> {
  let respuesta: Response;
  try {
    respuesta = await fetchWithTimeout(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.modelo,
        temperature: 0,
        tool_choice: "required",
        tools: herramientasParaElModelo(),
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: transcripcion },
        ],
        ...p.extra,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "no respondió en 8 s" : `sin conexión (${e instanceof Error ? e.name : "error"})` };
  }
  if (!respuesta.ok) {
    const detalle = (await respuesta.text().catch(() => "")).slice(0, 160);
    return { ok: false, error: `HTTP ${respuesta.status}${respuesta.status === 429 ? " (límite del plan gratuito)" : ""} ${detalle}` };
  }
  const cuerpo = (await respuesta.json()) as RespuestaChat;
  const llamada = cuerpo.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!llamada?.name) return { ok: false, error: "no llamó ninguna herramienta" };
  const leida = leerInterpretacion(llamada.name, llamada.arguments ?? "{}");
  return leida.ok ? leida : { ok: false, error: `respuesta inválida: ${leida.motivo.slice(0, 200)}` };
}

/**
 * Interpreta una transcripción. `catalogo` es lo que hay en el puesto (productos, clientes y proveedores).
 * `correccionDe`: la venta que Fructus leyó en voz alta; la transcripción es la corrección que dijo la persona («no, son ocho»).
 * `soloGroq` y `modeloGroq` sirven para medir modelos con /voz-precision sin que el respaldo cambie los números.
 */
export async function interpretar(
  transcripcion: string,
  opciones: { catalogo?: Catalogo; modeloGroq?: string; soloGroq?: boolean; correccionDe?: string } = {},
): Promise<ResultadoInterprete> {
  const inicio = performance.now();
  // El prompt fijo más el catálogo del puesto (docs/interprete-voz.md, secciones 2 y 2b).
  const sistema = opciones.catalogo ? `${PROMPT_SISTEMA}\n\n${bloqueCatalogo(opciones.catalogo)}` : PROMPT_SISTEMA;
  const intentos: Intento[] = [];
  for (const p of proveedores(opciones.modeloGroq)) {
    if (opciones.soloGroq && p.nombre !== "groq") break;
    if (!p.clave) {
      intentos.push({ modelo: p.modelo, error: "sin clave configurada" });
      continue;
    }
    const r = await preguntar(p, sistema, opciones.correccionDe ? mensajeCorreccion(opciones.correccionDe, transcripcion) : transcripcion);
    if (r.ok) return { ok: true, interpretacion: r.interpretacion, modelo: p.modelo, latenciaMs: Math.round(performance.now() - inicio), intentos };
    console.error("interprete: un proveedor falló", { modelo: p.modelo, error: r.error.slice(0, 120) });
    intentos.push({ modelo: p.modelo, error: r.error });
  }
  return { ok: false, motivo: "ningún proveedor respondió bien", latenciaMs: Math.round(performance.now() - inicio), intentos };
}
