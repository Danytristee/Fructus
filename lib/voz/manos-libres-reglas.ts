// Manos libres (ADR-0020): leer la venta, escuchar la respuesta corta y decidir. Lógica pura: dice en qué fase está y qué hay
// que hacer; quien la usa (components/voz/useManosLibres.ts) habla, abre el micrófono, envía y confirma.
//
//   leyendo ──terminó──▶ abriendo ──micrófono listo──▶ escuchando ──calló──▶ entendiendo ──«confirmo»──▶ guardando
//      ▲                     │ no habló             │ otra cosa (1.ª vez)
//      └─── «Para guardar, di confirmo» ◀───────────┘
//   Tocar la tarjeta, en cualquier momento: callado (la persona toma el control y confirma con el dedo).

/** Para empezar a hablar después de la lectura. Después se deja de escuchar: el silencio deja la tarjeta para tocar. */
export const VENTANA_RESPUESTA_MS = 5_000;
/** Una respuesta corta no dura más que esto: se envía aunque no se haya callado (ruido de fondo). */
export const TOPE_RESPUESTA_MS = 8_000;
/** Silencio que cierra una respuesta de una palabra: menos que el de un dictado, que tiene pausas para pensar. */
export const SILENCIO_RESPUESTA_MS = 800;
/** Lo que dice si oyó otra cosa: una sola vez, y vuelve a escuchar. */
export const REPREGUNTA = "Para guardar, di confirmo.";
/** Lo que dice cuando la base respondió que se guardó (candado 6): nunca antes. */
export const GUARDADO = "Guardado.";

export type Fase = "leyendo" | "abriendo" | "escuchando" | "entendiendo" | "guardando" | "callado";
/** Por qué quedó callado sin guardar: la tarjeta lo dice y pide el toque. */
export type Motivo = "no_hablo" | "no_confirmo" | "fallo";
export type EstadoManosLibres = { fase: Fase; intento: number; motivo: Motivo | null };

export type EventoManosLibres =
  /** Terminó de leer. `completa`: se dijo entera (false: la cortó un toque u otra frase). */
  | { tipo: "leida"; completa: boolean }
  /** El micrófono ya graba: recién ahora se dice «Te escucho» (antes, lo dicho no quedaba en el audio). */
  | { tipo: "abierto" }
  /** Habló y calló, o llegó al tope: hay respuesta para enviar. */
  | { tipo: "callo" }
  /** Pasó la ventana sin que hablara. */
  | { tipo: "vencio" }
  /** Lo que entendió el servidor de la respuesta; «fallo» si no respondió o no la entendió. */
  | { tipo: "respuesta"; respuesta: "confirmar" | "otra" | "fallo" }
  /** Tocó la tarjeta: toma el control. */
  | { tipo: "tocaron" };

/** Qué hacer: hablar la repregunta, abrir el micrófono, enviar lo oído, tirarlo, guardar la venta, o callar todo. */
export type EfectoManosLibres = "repreguntar" | "escuchar" | "enviar" | "descartar" | "confirmar" | "callar" | "nada";

export const LEYENDO: EstadoManosLibres = { fase: "leyendo", intento: 1, motivo: null };
export const CALLADO: EstadoManosLibres = { fase: "callado", intento: 1, motivo: null };

export function siguienteManosLibres(e: EstadoManosLibres, ev: EventoManosLibres): { estado: EstadoManosLibres; efecto: EfectoManosLibres } {
  const quedar = { estado: e, efecto: "nada" as const };
  const callado = (motivo: Motivo | null, efecto: EfectoManosLibres) => ({ estado: { ...e, fase: "callado" as const, motivo }, efecto });
  // Tocar la tarjeta gana siempre: lo que estuviera leyendo, oyendo o por llegar del servidor ya no cuenta.
  if (ev.tipo === "tocaron") return e.fase === "callado" || e.fase === "guardando" ? quedar : callado(null, "callar");
  switch (e.fase) {
    case "leyendo":
      if (ev.tipo !== "leida") return quedar;
      return ev.completa ? { estado: { ...e, fase: "abriendo" }, efecto: "escuchar" } : callado(null, "nada");
    case "abriendo":
      if (ev.tipo === "abierto") return { estado: { ...e, fase: "escuchando" }, efecto: "nada" };
      // Sin micrófono (sin permiso, ocupado) no hay respuesta: la tarjeta queda para tocar.
      if (ev.tipo === "vencio") return callado("no_hablo", "descartar");
      return quedar;
    case "escuchando":
      if (ev.tipo === "callo") return { estado: { ...e, fase: "entendiendo" }, efecto: "enviar" };
      if (ev.tipo === "vencio") return callado("no_hablo", "descartar");
      return quedar;
    case "entendiendo":
      if (ev.tipo !== "respuesta") return quedar;
      if (ev.respuesta === "confirmar") return { estado: { ...e, fase: "guardando" }, efecto: "confirmar" };
      if (ev.respuesta === "fallo") return callado("fallo", "nada");
      // Oyó otra cosa («sí», un cliente que pregunta): se repregunta una vez. La segunda, se deja para tocar.
      return e.intento === 1 ? { estado: { fase: "leyendo", intento: 2, motivo: null }, efecto: "repreguntar" } : callado("no_confirmo", "nada");
    case "guardando":
    case "callado":
      return quedar;
  }
}

/** La línea sobre Confirmar: qué está haciendo la voz o por qué se dejó para tocar. null si no hay nada que decir. */
export function notaManosLibres(e: EstadoManosLibres): string | null {
  switch (e.fase) {
    case "leyendo":
    case "abriendo": // unos 200 ms: se deja la línea anterior para que no parpadee
      return e.intento === 1 ? "Te la estoy leyendo…" : "Para guardar, di «confirmo».";
    case "escuchando":
      return "Te escucho: di «confirmo» o toca Confirmar.";
    case "entendiendo":
      return "Entendiendo…";
    case "guardando":
      return null;
    case "callado":
      if (e.motivo === "no_hablo") return "No te oí. Si está bien, toca Confirmar.";
      if (e.motivo === "no_confirmo") return "No guardé. Si está bien, toca Confirmar.";
      if (e.motivo === "fallo") return "No te entendí. Si está bien, toca Confirmar.";
      return null;
  }
}
