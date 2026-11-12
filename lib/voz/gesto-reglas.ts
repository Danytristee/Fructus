// El gesto del botón de voz: mantener para hablar (soltar envía) o tocar una vez para que quede escuchando (otro toque envía).
// Lógica pura: no importa React ni el micrófono. Quien la usa ejecuta el efecto que devuelve.

/** Un toque más corto que esto no es «mantener»: deja el botón escuchando sin el dedo encima. */
export const TOQUE_MAXIMO_MS = 300;
/** Cuánto hay que subir el dedo (px) mientras se mantiene para dejarlo escuchando, como el candado de los audios de WhatsApp. */
export const SUBIDA_PARA_BLOQUEAR = 80;
/** El servidor rechaza audios de más de 60 s: a los 55 se envía solo, por si alguien lo dejó escuchando y se olvidó. */
export const TOPE_ESCUCHA_MS = 55_000;

export type Gesto =
  | { fase: "reposo" }
  /** El dedo está encima desde `desde` (ms). */
  | { fase: "presionado"; desde: number }
  /** Escucha sin el dedo encima: el siguiente toque envía. */
  | { fase: "bloqueado" }
  /** Bloqueado y el dedo volvió a bajar: al levantarlo se envía. */
  | { fase: "cerrando" };

export type EventoGesto =
  | { tipo: "bajar"; en: number }
  | { tipo: "subir"; en: number }
  /** El dedo se movió: `subida` son los px por encima de donde bajó (negativo si bajó más). */
  | { tipo: "deslizar"; subida: number }
  /** El navegador se quedó con el toque (pointercancel). */
  | { tipo: "perder" }
  /** Tocó «Cancelar»: se descarta sin enviar. */
  | { tipo: "cancelar" }
  /** Pasó TOPE_ESCUCHA_MS escuchando. */
  | { tipo: "tope" };

/** Qué hacer con el micrófono: empezar a grabar, seguir sin el dedo, enviar lo grabado, tirarlo o nada. */
export type EfectoGesto = "empezar" | "bloquear" | "enviar" | "descartar" | "nada";

export const REPOSO: Gesto = { fase: "reposo" };

export function siguienteGesto(g: Gesto, e: EventoGesto): { gesto: Gesto; efecto: EfectoGesto } {
  const quedar = { gesto: g, efecto: "nada" as const };
  switch (g.fase) {
    case "reposo":
      return e.tipo === "bajar" ? { gesto: { fase: "presionado", desde: e.en }, efecto: "empezar" } : quedar;
    case "presionado":
      if (e.tipo === "subir") {
        return e.en - g.desde < TOQUE_MAXIMO_MS ? { gesto: { fase: "bloqueado" }, efecto: "bloquear" } : { gesto: REPOSO, efecto: "enviar" };
      }
      // Subió el dedo hasta el candado: queda escuchando; al levantarlo no se envía (en «bloqueado», «subir» no hace nada).
      if (e.tipo === "deslizar" && e.subida >= SUBIDA_PARA_BLOQUEAR) return { gesto: { fase: "bloqueado" }, efecto: "bloquear" };
      // Si el navegador se queda con el toque mientras se mantiene, se envía lo dicho: así era antes de existir el bloqueo.
      if (e.tipo === "perder" || e.tipo === "tope") return { gesto: REPOSO, efecto: "enviar" };
      if (e.tipo === "cancelar") return { gesto: REPOSO, efecto: "descartar" };
      return quedar;
    case "bloqueado":
      if (e.tipo === "bajar") return { gesto: { fase: "cerrando" }, efecto: "nada" };
      if (e.tipo === "tope") return { gesto: REPOSO, efecto: "enviar" };
      if (e.tipo === "cancelar") return { gesto: REPOSO, efecto: "descartar" };
      return quedar;
    case "cerrando":
      if (e.tipo === "subir" || e.tipo === "tope") return { gesto: REPOSO, efecto: "enviar" };
      // El toque que iba a enviar se perdió: sigue escuchando, nada de lo dicho se pierde.
      if (e.tipo === "perder") return { gesto: { fase: "bloqueado" }, efecto: "nada" };
      if (e.tipo === "cancelar") return { gesto: REPOSO, efecto: "descartar" };
      return quedar;
  }
}

/** Cuánto falta para el candado, de 0 a 1, en pasos de 0.1: así el dibujo se actualiza unas 10 veces y no en cada píxel. */
export function avanceAlCandado(subida: number): number {
  return Math.round(Math.min(1, Math.max(0, subida / SUBIDA_PARA_BLOQUEAR)) * 10) / 10;
}

/** La etiqueta mientras escucha: con el dedo encima basta el tiempo; sin el dedo, además, cómo terminar. */
export function textoEscuchando(segundos: number, bloqueado: boolean): string {
  const reloj = `0:${String(Math.min(59, Math.max(0, Math.floor(segundos)))).padStart(2, "0")}`;
  return bloqueado ? `Te escucho ${reloj} · toca para enviar` : `Te escucho… ${reloj}`;
}
