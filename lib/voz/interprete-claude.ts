import "server-only";

// El intérprete con Claude (ADR-0026): la misma pregunta que se le hace a Groq (el prompt, las 8 herramientas de esquemas.ts y la
// frase), por el SDK oficial de Anthropic. Claude no escucha audio: la voz la pasa a texto Whisper (lib/voz/stt.ts) y aquí llega
// el texto. La transcripción nunca va a un log (CLAUDE.md, «Seguridad y claves»).
import Anthropic from "@anthropic-ai/sdk";

import { herramientasParaElModelo, leerInterpretacion, type Interpretacion } from "./esquemas";
import type { Pedido } from "./respaldo-reglas";

/** El modelo por defecto: el más rápido y barato (centavos al mes con 60 ventas al día). Se cambia con CLAUDE_MODELO_LLM. */
export const MODELO_CLAUDE = "claude-haiku-5-5";

/** El mismo tope que Groq: de soltar el botón a ver la tarjeta hay 2.5 s, y después de 8 s se pasa al siguiente (principio 8). */
const TOPE_MS = 8_000;

// Las herramientas en el formato de Anthropic, salidas de los mismos esquemas de Zod que las de Groq: nunca dos versiones.
const HERRAMIENTAS: Anthropic.Tool[] = herramientasParaElModelo().map(({ function: f }) => ({
  name: f.name,
  description: f.description,
  input_schema: f.parameters as Anthropic.Tool.InputSchema,
}));

/**
 * Los modelos que no aceptan forzar una herramienta (Sonnet 5.5, Opus 5.5, Fable) la eligen solos con el prompt («llamas
 * EXACTAMENTE UNA herramienta») y piensan poco; Haiku la elige forzada y sin pensar, que es lo más rápido.
 */
const eligeSolo = (modelo: string) => /sonnet-5-5|opus-5-5|fable|mythos/.test(modelo);

function errorDe(e: unknown): { error: string; estado?: number } {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { error: "no respondió en 8 s" };
  if (e instanceof Anthropic.APIConnectionError) return { error: "sin conexión" };
  if (e instanceof Anthropic.APIError) return { estado: e.status, error: `HTTP ${e.status}${e.status === 429 ? " (sin cupo)" : ""} ${e.message.slice(0, 120)}` };
  return { error: e instanceof Error ? e.name : "error" };
}

/** Le pide a Claude que elija una herramienta. Si la respuesta no calza con el esquema, no se usa: no se adivina. */
export async function preguntarAClaude(modelo: string, clave: string, sistema: string, mensaje: string): Promise<Pedido<Interpretacion>> {
  const cliente = new Anthropic({ apiKey: clave, timeout: TOPE_MS, maxRetries: 0 });
  const solo = eligeSolo(modelo);
  let respuesta: Anthropic.Message;
  try {
    respuesta = await cliente.messages.create({
      model: modelo,
      max_tokens: solo ? 4_000 : 1_000,
      // Las herramientas y el prompt son iguales en cada dictado: van en caché y cada llamada cobra solo la frase.
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      tools: HERRAMIENTAS,
      tool_choice: solo ? { type: "auto", disable_parallel_tool_use: true } : { type: "any", disable_parallel_tool_use: true },
      ...(solo ? {} : { thinking: { type: "disabled" as const } }),
      output_config: { effort: "low" },
      messages: [{ role: "user", content: mensaje }],
    });
  } catch (e) {
    return { ok: false, ...errorDe(e) };
  }
  if (respuesta.stop_reason === "refusal") return { ok: false, error: "el modelo no quiso responder" };
  const llamada = respuesta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!llamada) return { ok: false, error: "no llamó ninguna herramienta" };
  const leida = leerInterpretacion(llamada.name, llamada.input);
  return leida.ok ? { ok: true, valor: leida.interpretacion } : { ok: false, error: `respuesta inválida: ${leida.motivo.slice(0, 200)}` };
}
