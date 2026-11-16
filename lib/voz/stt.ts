import "server-only";

// El audio de la persona → texto. Groq (Whisper) primero, con el vocabulario del puesto y un tope de 8 s; si la cuenta se quedó
// sin cupo, la de respaldo; si falla, Gemini (si hay clave), que también entiende audio. El orden vive en respaldo-reglas.ts.
// La transcripción nunca va a los logs (CLAUDE.md, «Seguridad y claves»).
import { fetchWithTimeout } from "../supabase/fetch-con-tope";
import { cuentasGroq, probarEnOrden, type Intento, type Pedido, type Proveedor } from "./respaldo-reglas";

export type ResultadoTranscripcion =
  | { ok: true; texto: string; modelo: string; latenciaMs: number; intentos: Intento[] }
  | { ok: false; motivo: string; latenciaMs: number; intentos: Intento[] };

type Respuesta = Pedido<string>;

const extension = (tipo: string) => (tipo.includes("webm") ? "webm" : tipo.includes("ogg") ? "ogg" : tipo.includes("wav") ? "wav" : "m4a");

async function conGroq(audio: Blob, vocabulario: string | undefined, clave: string, modelo: string): Promise<Respuesta> {
  const formulario = new FormData();
  formulario.append("file", audio, `audio.${extension(audio.type)}`);
  formulario.append("model", modelo);
  formulario.append("language", "es");
  formulario.append("temperature", "0");
  formulario.append("response_format", "json");
  if (vocabulario) formulario.append("prompt", vocabulario);
  return llamar("https://api.groq.com/openai/v1/audio/transcriptions", { Authorization: `Bearer ${clave}` }, formulario, (cuerpo) =>
    typeof (cuerpo as { text?: unknown }).text === "string" ? (cuerpo as { text: string }).text : null,
  );
}

async function conGemini(audio: Blob, vocabulario: string | undefined, clave: string, modelo: string): Promise<Respuesta> {
  const datos = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const instruccion =
    "Transcribe exactamente lo que se dice en este audio, en español, con los números en cifras. Responde solo con la transcripción." +
    (vocabulario ? ` Contexto y vocabulario: ${vocabulario}` : "");
  const cuerpo = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: audio.type || "audio/webm", data: datos } }, { text: instruccion }] }],
    generationConfig: { temperature: 0 },
  });
  // La clave va en una cabecera, no en la URL: las URLs terminan en logs.
  return llamar(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    { "x-goog-api-key": clave, "Content-Type": "application/json" },
    cuerpo,
    (r) => (r as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text ?? null,
  );
}

async function llamar(url: string, cabeceras: Record<string, string>, cuerpo: BodyInit, leer: (json: unknown) => string | null): Promise<Respuesta> {
  let respuesta: Response;
  try {
    respuesta = await fetchWithTimeout(url, { method: "POST", headers: cabeceras, body: cuerpo });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "no respondió en 8 s" : `sin conexión (${e instanceof Error ? e.name : "error"})` };
  }
  if (!respuesta.ok) {
    const detalle = (await respuesta.text().catch(() => "")).slice(0, 160);
    return { ok: false, estado: respuesta.status, error: `HTTP ${respuesta.status}${respuesta.status === 429 ? " (límite del plan gratuito)" : ""} ${detalle}` };
  }
  const texto = leer(await respuesta.json())?.trim();
  return texto ? { ok: true, valor: texto } : { ok: false, error: "no se oyó nada que transcribir" };
}

/**
 * Transcribe un audio. `vocabulario` sale de vocabularioWhisper() con el catálogo del puesto.
 * `soloGroq` sirve para medir Whisper sin que Gemini cambie los números; las dos cuentas de Groq usan el mismo modelo.
 */
export async function transcribir(audio: Blob, opciones: { vocabulario?: string; soloGroq?: boolean } = {}): Promise<ResultadoTranscripcion> {
  const inicio = performance.now();
  const whisper = process.env.GROQ_MODELO_STT ?? "whisper-large-v3-turbo";
  const gemini = process.env.GEMINI_MODELO_STT ?? "gemini-2.5-flash";
  const proveedores: Proveedor<string>[] = [
    ...cuentasGroq(process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_RESPALDO).map(({ cuenta, clave }): Proveedor<string> => ({
      servicio: "groq",
      modelo: whisper,
      cuenta,
      clave,
      pedir: (c) => conGroq(audio, opciones.vocabulario, c, whisper),
    })),
    { servicio: "gemini", modelo: gemini, clave: process.env.GEMINI_API_KEY, pedir: (c) => conGemini(audio, opciones.vocabulario, c, gemini) },
  ];
  const r = await probarEnOrden(
    proveedores.filter((p) => !opciones.soloGroq || p.servicio === "groq"),
    (i) => console.error("stt: un proveedor falló", { modelo: i.modelo, cuenta: i.cuenta, error: i.error.slice(0, 120) }),
  );
  const latenciaMs = Math.round(performance.now() - inicio);
  return r.ok
    ? { ok: true, texto: r.valor, modelo: r.modelo, latenciaMs, intentos: r.intentos }
    : { ok: false, motivo: "ningún proveedor transcribió el audio", latenciaMs, intentos: r.intentos };
}
