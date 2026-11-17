// Qué hace el botón de voz con lo que pasó al enviar el audio: abrir la tarjeta, o decir qué hacer y si se guarda el
// audio para reintentarlo (CLAUDE.md, «Todo puede fallar»: nunca se pierde lo que la persona dictó). Lógica pura.
import type { Tarjeta } from "./tarjeta-reglas";

/** Menos que esto es un toque, no una frase: se enseña a mantener el botón y no se envía nada. */
export const DURACION_MINIMA_MS = 600;

/** El nombre del archivo según lo que grabó el celular: webm (Chrome), m4a (Safari) o wav (lo que siguió a «Hola Fructus»). */
export const nombreDelAudio = (tipo: string) => (tipo.includes("wav") ? "voz.wav" : tipo.includes("mp4") ? "voz.m4a" : "voz.webm");

export const NO_TE_ENTENDI = "No te entendí, inténtalo otra vez.";
const SIN_SENAL = "Sin señal: no pude enviar lo que dijiste. Lo guardé para reintentarlo.";

export type Desenlace =
  | { tipo: "tarjeta"; comandoId: number; tarjeta: Tarjeta }
  /**
   * Lo dicho después de «Hola Fructus» no era para Fructus (el segundo paso, lib/voz/palabra-reglas.ts): «parecida» si se oyó
   * «frutas» en vez de la frase; «sin_orden» si dijo la frase y nada más. No se guardó nada y no hay nada que reintentar.
   */
  | { tipo: "ignorado"; motivo: "parecida" | "sin_orden" }
  | {
      tipo: "error";
      mensaje: string;
      /** Si el mismo audio puede servir al reintentar (falló la red o el servicio, no lo que se dijo). */
      conservarAudio: boolean;
    };

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** De la respuesta de POST /api/voz (estado y cuerpo ya leído como JSON, o null si no era JSON) al desenlace. */
export function desenlaceDeRespuesta(estado: number, cuerpo: unknown): Desenlace {
  const c = esObjeto(cuerpo) ? cuerpo : {};
  const mensaje = typeof c.error === "string" ? c.error : null;

  if (estado === 200 && (c.ignorado === "parecida" || c.ignorado === "sin_orden")) return { tipo: "ignorado", motivo: c.ignorado };

  if (estado === 200 && typeof c.comandoId === "number" && esObjeto(c.tarjeta) && typeof c.tarjeta.tipo === "string") {
    const tarjeta = c.tarjeta as Tarjeta;
    // Entendió que no era nada: el mismo audio daría lo mismo, se pide decirlo otra vez.
    if (tarjeta.tipo === "no_entendido") return { tipo: "error", mensaje: NO_TE_ENTENDI, conservarAudio: false };
    return { tipo: "tarjeta", comandoId: c.comandoId, tarjeta };
  }
  // Sin sesión el audio sigue sirviendo: se reintenta después de volver a entrar.
  if (estado === 401) return { tipo: "error", mensaje: mensaje ?? "Tu sesión terminó. Vuelve a entrar.", conservarAudio: true };
  // Lo que se envió no sirve (sin permiso, vacío, muy largo, no es audio): reintentar el mismo audio no arregla nada.
  if (estado >= 400 && estado < 500) return { tipo: "error", mensaje: mensaje ?? NO_TE_ENTENDI, conservarAudio: false };
  // Falló un servicio (Groq, Gemini, la base): el audio se guarda. El servidor puede decir que no hace falta.
  return { tipo: "error", mensaje: mensaje ?? NO_TE_ENTENDI, conservarAudio: c.conservarAudio !== false };
}

/** Se cayó la red o no respondió a tiempo. */
export function desenlaceSinRed(): Desenlace {
  return { tipo: "error", mensaje: SIN_SENAL, conservarAudio: true };
}
