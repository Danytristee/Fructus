import "server-only";

// Lo que dijo la persona (ya en texto) → una herramienta con sus datos, validada con Zod.
// Claude Haiku 5.5 primero (ADR-0024: 97.8 % de datos clave contra 84.9 % de gpt-oss-120b); si no responde en 8 s o falla, Groq;
// si esa cuenta se quedó sin cupo, la de respaldo; si Groq tampoco, Gemini (si hay clave). Cómo se pasa de uno a otro vive en
// respaldo-reglas.ts. Ninguno inventa: si la respuesta no calza con el esquema, no se usa. La transcripción nunca va a
// los logs (CLAUDE.md, «Seguridad y claves»).
import { fetchWithTimeout } from "../supabase/fetch-con-tope";
import { bloqueCatalogo, type Catalogo } from "./catalogo-reglas";
import { sinEstadoQueEsNombre } from "./como-llego-reglas";
import { herramientasParaElModelo, leerInterpretacion, type Interpretacion, type VentaActual } from "./esquemas";
import { MODELO_CLAUDE, preguntarAClaude } from "./interprete-claude";
import { PROMPT_SISTEMA, mensajeCorreccion } from "./prompt";
import { cuentasGroq, probarEnOrden, type Intento, type Pedido, type Proveedor } from "./respaldo-reglas";

/** Un servicio que entiende el formato de chat de OpenAI. Groq y Gemini lo hablan los dos. */
type Servicio = { url: string; modelo: string; extra: Record<string, unknown> };

export type ResultadoInterprete =
  | { ok: true; interpretacion: Interpretacion; modelo: string; latenciaMs: number; intentos: Intento[] }
  | { ok: false; motivo: string; latenciaMs: number; intentos: Intento[] };

type RespuestaChat = { choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };

async function preguntar(p: Servicio, clave: string, sistema: string, transcripcion: string): Promise<Pedido<Interpretacion>> {
  let respuesta: Response;
  try {
    respuesta = await fetchWithTimeout(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
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
    return { ok: false, estado: respuesta.status, error: `HTTP ${respuesta.status}${respuesta.status === 429 ? " (límite del plan gratuito)" : ""} ${detalle}` };
  }
  const cuerpo = (await respuesta.json()) as RespuestaChat;
  const llamada = cuerpo.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!llamada?.name) return { ok: false, error: "no llamó ninguna herramienta" };
  const leida = leerInterpretacion(llamada.name, llamada.arguments ?? "{}");
  return leida.ok ? { ok: true, valor: leida.interpretacion } : { ok: false, error: `respuesta inválida: ${leida.motivo.slice(0, 200)}` };
}

/** Lo que no se le pide al modelo porque se puede decidir contando: en una compra, el «verde» que era parte del nombre de la fruta. */
function afinar(interpretacion: Interpretacion, transcripcion: string): Interpretacion {
  if (interpretacion.herramienta !== "registrar_compra") return interpretacion;
  return { ...interpretacion, datos: { ...interpretacion.datos, items: sinEstadoQueEsNombre(transcripcion, interpretacion.datos.items) } };
}

/**
 * Interpreta una transcripción. `catalogo` es lo que hay en el puesto (productos, clientes y proveedores).
 * `correccionDe`: la venta que Fructus leyó en voz alta, en los campos de registrar_venta; la transcripción es la corrección que dijo
 * la persona («no, son ocho»).
 * `solo`, `modeloGroq` y `modeloClaude` sirven para medir modelos con /voz-precision sin que otro servicio cambie los números. Las
 * dos cuentas de Groq usan el mismo modelo, así que la de respaldo sí entra: solo suma cupo.
 */
export async function interpretar(
  transcripcion: string,
  opciones: { catalogo?: Catalogo; modeloGroq?: string; modeloClaude?: string; solo?: "groq" | "anthropic"; correccionDe?: VentaActual } = {},
): Promise<ResultadoInterprete> {
  const inicio = performance.now();
  // El prompt fijo más el catálogo del puesto (docs/interprete-voz.md, secciones 2 y 2b).
  const sistema = opciones.catalogo ? `${PROMPT_SISTEMA}\n\n${bloqueCatalogo(opciones.catalogo)}` : PROMPT_SISTEMA;
  const mensaje = opciones.correccionDe ? mensajeCorreccion(opciones.correccionDe, transcripcion) : transcripcion;
  const groq: Servicio = {
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelo: opciones.modeloGroq ?? process.env.GROQ_MODELO_LLM ?? "openai/gpt-oss-120b",
    // Los gpt-oss razonan antes de responder: «low» basta para elegir una herramienta y cuida la latencia.
    extra: { reasoning_effort: "low" },
  };
  const gemini: Servicio = {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelo: process.env.GEMINI_MODELO_LLM ?? "gemini-2.5-flash",
    extra: {},
  };
  const proveedores: Proveedor<Interpretacion>[] = [
    ...cuentasGroq(process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_RESPALDO).map(({ cuenta, clave }): Proveedor<Interpretacion> => ({
      servicio: "groq",
      modelo: groq.modelo,
      cuenta,
      clave,
      pedir: (c) => preguntar(groq, c, sistema, mensaje),
    })),
    { servicio: "gemini", modelo: gemini.modelo, clave: process.env.GEMINI_API_KEY, pedir: (c) => preguntar(gemini, c, sistema, mensaje) },
  ];
  const modeloClaude = opciones.modeloClaude ?? process.env.CLAUDE_MODELO_LLM ?? MODELO_CLAUDE;
  const claude: Proveedor<Interpretacion> = {
    servicio: "anthropic",
    modelo: modeloClaude,
    clave: process.env.ANTHROPIC_API_KEY,
    pedir: (c) => preguntarAClaude(modeloClaude, c, sistema, mensaje),
  };
  const r = await probarEnOrden(
    opciones.solo === "anthropic" ? [claude] : opciones.solo ? proveedores.filter((p) => p.servicio === opciones.solo) : [claude, ...proveedores],
    (i) => console.error("interprete: un proveedor falló", { modelo: i.modelo, cuenta: i.cuenta, error: i.error.slice(0, 120) }),
  );
  const latenciaMs = Math.round(performance.now() - inicio);
  return r.ok
    ? { ok: true, interpretacion: afinar(r.valor, transcripcion), modelo: r.modelo, latenciaMs, intentos: r.intentos }
    : { ok: false, motivo: "ningún proveedor respondió bien", latenciaMs, intentos: r.intentos };
}
