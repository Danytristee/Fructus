// Manos libres (ADR-0020): leer la venta, escuchar la respuesta corta y decidir. Lógica pura: dice en qué fase está y qué hay
// que hacer; quien la usa (components/voz/useManosLibres.ts) habla, abre el micrófono, envía, anota el pago y confirma.
//
//   leyendo ──terminó──▶ abriendo ──micrófono listo──▶ escuchando ──calló──▶ entendiendo ──«confirmo»──▶ guardando
//      ▲                     │ no habló             │ otra cosa (1.ª vez)
//      └─── «Para guardar, di confirmo» ◀───────────┘
//
// Si falta saber si pagó, la primera pregunta es «¿Pagó o lo debe?»: la respuesta se anota en la tarjeta, se repite y se pregunta
// «¿Confirmo?» (la venta ya se leyó al preguntar). Si en vez de «confirmo» corrige («no, son ocho cajas»), la tarjeta se rehace y
// se dice lo que cambió; si dice «repite» o «¿qué?», se vuelve a leer entera (hasta REPETICIONES veces). Con dudas del intérprete (o si falta otro dato) solo se avisa: no se escucha nada y se confirma con el dedo.
// Tocar la tarjeta, en cualquier momento: callado (la persona toma el control).
import type { Pago } from "./respuesta-reglas";

/** Para empezar a hablar después de la lectura. Después se deja de escuchar: el silencio deja la tarjeta para tocar. */
export const VENTANA_RESPUESTA_MS = 5_000;
/** Una respuesta corta no dura más que esto: se envía aunque no se haya callado (ruido de fondo). */
export const TOPE_RESPUESTA_MS = 8_000;
/** Silencio que cierra una respuesta de una palabra: menos que el de un dictado, que tiene pausas para pensar. */
export const SILENCIO_RESPUESTA_MS = 800;
/** Lo que dice si oyó otra cosa: una sola vez, y vuelve a escuchar. */
export const REPREGUNTA = "Para guardar, di confirmo.";
export const REPREGUNTA_PAGO = "¿Pagó o lo debe?";
/** Cuántas veces se vuelve a leer si pide «repite»: después, cuenta como otra cosa (nada se lee en bucle). */
const REPETICIONES = 2;
/** Lo que dice cuando la base respondió que se guardó (candado 6): nunca antes. */
export const GUARDADO = "Guardado.";

export type Fase = "leyendo" | "abriendo" | "escuchando" | "entendiendo" | "anotando" | "guardando" | "callado";
/** Qué espera oír: «confirmo», «pagó» o «lo debe», o nada (solo se avisó). */
export type Pregunta = "confirmar" | "pago" | "ninguna";
/** Por qué quedó callado sin guardar: la tarjeta lo dice y pide el toque. */
type Motivo = "no_hablo" | "no_entendio" | "fallo" | "sin_senal" | "aviso" | "falta";
export type EstadoManosLibres = { fase: Fase; pregunta: Pregunta; intento: number; motivo: Motivo | null; repeticiones: number };

export type EventoManosLibres =
  /** Terminó de leer. `completa`: se dijo entera (false: la cortó un toque u otra frase). */
  | { tipo: "leida"; completa: boolean }
  /** El micrófono ya graba: recién ahora se dice «Te escucho» (antes, lo dicho no quedaba en el audio). */
  | { tipo: "abierto" }
  /** Habló y calló, o llegó al tope: hay respuesta para enviar. */
  | { tipo: "callo" }
  /** Pasó la ventana sin que hablara, o no hay micrófono. */
  | { tipo: "vencio" }
  /** No hay señal: la respuesta no se puede entender (Whisper está en el servidor). */
  | { tipo: "sin_senal" }
  /** Lo que entendió el servidor de «¿Confirmo?»: confirma, corrige la venta, otra cosa, o «fallo» si no respondió. */
  | { tipo: "respuesta"; respuesta: "confirmar" | "corregir" | "otra" | "fallo" }
  /** Lo que entendió de «¿Pagó o lo debe?»; null si no se entendió, «fallo» si el servidor no respondió. */
  | { tipo: "pago"; pago: Pago | null | "fallo" }
  /** Se anotó el pago en la tarjeta: `lista`, la venta quedó completa y se pregunta «¿Confirmo?». */
  | { tipo: "anotado"; lista: boolean }
  /** La tarjeta se rehízo con la corrección: qué pregunta toca ahora (la venta corregida puede dejar dudas o faltar algo). */
  | { tipo: "corregida"; pregunta: Pregunta }
  /** Pidió que lo lea otra vez («repite», «¿qué?», «no te escuché»). */
  | { tipo: "repetir" }
  /** Tocó la tarjeta: toma el control. */
  | { tipo: "tocaron" };

/** Qué hacer: hablar la repregunta, abrir el micrófono, enviar lo oído, tirarlo, anotar el pago, rehacer la tarjeta con la corrección,
 * guardar, leer de nuevo o callar. */
export type EfectoManosLibres = "repreguntar" | "escuchar" | "enviar" | "descartar" | "anotar" | "corregir" | "releer" | "repetir" | "confirmar" | "callar" | "nada";

export const CALLADO: EstadoManosLibres = { fase: "callado", pregunta: "ninguna", intento: 1, motivo: null, repeticiones: 0 };
export const leyendo = (pregunta: Pregunta): EstadoManosLibres => ({ fase: "leyendo", pregunta, intento: 1, motivo: null, repeticiones: 0 });

export function siguienteManosLibres(e: EstadoManosLibres, ev: EventoManosLibres): { estado: EstadoManosLibres; efecto: EfectoManosLibres } {
  const quedar = { estado: e, efecto: "nada" as const };
  const callado = (motivo: Motivo | null, efecto: EfectoManosLibres) => ({ estado: { ...e, fase: "callado" as const, motivo }, efecto });
  // Tocar la tarjeta gana siempre: lo que estuviera leyendo, oyendo o por llegar del servidor ya no cuenta.
  if (ev.tipo === "tocaron") return e.fase === "callado" || e.fase === "guardando" ? quedar : callado(null, "callar");
  switch (e.fase) {
    case "leyendo":
      if (ev.tipo !== "leida") return quedar;
      if (!ev.completa) return callado(null, "nada");
      // Un aviso («tengo una duda», «falta el precio») no espera respuesta: se confirma con el dedo.
      if (e.pregunta === "ninguna") return callado("aviso", "nada");
      return { estado: { ...e, fase: "abriendo" }, efecto: "escuchar" };
    case "abriendo":
      if (ev.tipo === "abierto") return { estado: { ...e, fase: "escuchando" }, efecto: "nada" };
      if (ev.tipo === "vencio") return callado("no_hablo", "descartar");
      if (ev.tipo === "sin_senal") return callado("sin_senal", "descartar");
      return quedar;
    case "escuchando":
      if (ev.tipo === "callo") return { estado: { ...e, fase: "entendiendo" }, efecto: "enviar" };
      if (ev.tipo === "vencio") return callado("no_hablo", "descartar");
      return quedar;
    case "entendiendo": {
      if (ev.tipo === "sin_senal") return callado("sin_senal", "nada");
      const otraVez = e.intento === 1 ? { estado: { ...e, fase: "leyendo" as const, intento: 2 }, efecto: "repreguntar" as const } : callado("no_entendio", "nada");
      // «Repite»: se lee otra vez lo mismo, entero, y se vuelve a escuchar. Después de REPETICIONES, cuenta como otra cosa.
      if (ev.tipo === "repetir") {
        return e.repeticiones < REPETICIONES ? { estado: { ...e, fase: "leyendo", intento: 1, repeticiones: e.repeticiones + 1 }, efecto: "repetir" } : otraVez;
      }
      if (ev.tipo === "respuesta" && e.pregunta === "confirmar") {
        if (ev.respuesta === "confirmar") return { estado: { ...e, fase: "guardando" }, efecto: "confirmar" };
        if (ev.respuesta === "corregir") return { estado: { ...e, fase: "anotando" }, efecto: "corregir" };
        if (ev.respuesta === "fallo") return callado("fallo", "nada");
        // Oyó otra cosa («sí», un cliente que pregunta): se repregunta una vez. La segunda, se deja para tocar.
        return otraVez;
      }
      // «Pagó quinientos»: la respuesta trae lo que pagó, y el servidor rehizo la venta con ese pago parcial (ADR-0025).
      if (ev.tipo === "respuesta" && ev.respuesta === "corregir" && e.pregunta === "pago") return { estado: { ...e, fase: "anotando" }, efecto: "corregir" };
      if (ev.tipo === "pago" && e.pregunta === "pago") {
        if (ev.pago === "fallo") return callado("fallo", "nada");
        if (ev.pago === null) return otraVez;
        return { estado: { ...e, fase: "anotando" }, efecto: "anotar" };
      }
      return quedar;
    }
    case "anotando":
      // Ya se sabe si pagó: se repite la respuesta y se pregunta «¿Confirmo?». La venta se acaba de leer al preguntar.
      if (ev.tipo === "anotado") return ev.lista ? { estado: leyendo("confirmar"), efecto: "releer" } : callado("falta", "nada");
      // Corregida: se lee lo nuevo con su pregunta. Las respuestas cuentan desde cero: puede volver a corregir o confirmar.
      if (ev.tipo === "corregida") return { estado: leyendo(ev.pregunta), efecto: "releer" };
      return quedar;
    case "guardando":
    case "callado":
      return quedar;
  }
}

/**
 * La línea sobre Confirmar: qué está haciendo la voz o por qué se dejó para tocar. null si no hay nada que decir. `corrige`: la
 * tarjeta se puede corregir hablando (la venta), y escuchando lo enseña: nada en la pantalla decía que «no, son 8» funciona, y
 * «o toca Confirmar» sobraba con el botón justo abajo (/formidable 2026-11-16). También enseña «repite»: desde que tras responder o
 * corregir solo se dice lo nuevo, pedirla es la única forma de oír la venta entera, y quien no oyó por un camión soltaba una caja
 * para tocar (/formidable 2026-11-17).
 */
export function notaManosLibres(e: EstadoManosLibres, { corrige = false }: { corrige?: boolean } = {}): string | null {
  const pago = e.pregunta === "pago";
  const tocar = pago ? "Toca Pagó o Lo debe." : "Si está bien, toca Confirmar.";
  switch (e.fase) {
    case "leyendo":
    case "abriendo": // unos 200 ms: se deja la línea anterior para que no parpadee
      if (e.intento === 1) return "Te la estoy leyendo…";
      return pago ? "¿Pagó o lo debe?" : "Para guardar, di «confirmo».";
    case "escuchando":
      // «Repite» también vale aquí (/api/voz/respuesta lo revisa en cualquier pregunta): se dice, o no se sabe (2.ª prueba ciega).
      if (pago) return "Te escucho: di «pagó», «lo debe» o «repite».";
      return corrige ? "Te escucho: di «confirmo», «repite» o lo que hay que cambiar." : "Te escucho: di «confirmo» o toca Confirmar.";
    case "entendiendo":
    case "anotando":
      return "Entendiendo…";
    case "guardando":
      return null;
    case "callado":
      switch (e.motivo) {
        case "no_hablo":
          return `No te oí. ${tocar}`;
        case "no_entendio":
          return pago ? "No te entendí. Toca Pagó o Lo debe." : "No guardé. Si está bien, toca Confirmar.";
        case "fallo":
          return `No te entendí. ${tocar}`;
        case "sin_senal":
          return `Sin señal no te entiendo. ${tocar}`;
        case "falta":
          return "Falta un dato: elígelo en la tarjeta.";
        case "aviso": // ya lo dijo en voz alta, y la tarjeta muestra la duda o lo que falta
        case null:
          return null;
      }
  }
}
