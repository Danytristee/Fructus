// Las voces del celular y la que eligió la persona (lib/voz/voces-reglas.ts decide cuál usar). La elegida se recuerda en el celular,
// no en la cuenta, como «Manos libres»: cada celular tiene sus voces. Es comodidad: si se borra, vuelve a la mejor que haya. Solo navegador.
import type { Voz } from "@/lib/voz/voces-reglas";

const CLAVE = "fructus:voz";
const EVENTO = "fructus:voz";

const NINGUNA: SpeechSynthesisVoice[] = [];
let crudas: SpeechSynthesisVoice[] = NINGUNA;
let foto: Voz[] = [];

const sintetizador = () => (typeof window === "undefined" ? undefined : window.speechSynthesis);

/**
 * Las voces del celular. Se guarda la misma lista mientras el navegador no cambie la suya, para useSyncExternalStore. Chrome las
 * carga tarde: la primera vez puede venir vacía, y llega «voiceschanged».
 */
export function leerVoces(): Voz[] {
  const ahora = sintetizador()?.getVoices() ?? NINGUNA;
  if (ahora.length !== crudas.length || ahora.some((v, i) => v !== crudas[i])) {
    crudas = ahora;
    foto = ahora.map((v) => ({ uri: v.voiceURI, nombre: v.name, lang: v.lang, local: v.localService }));
  }
  return foto;
}

/** La voz del navegador que corresponde a una de leerVoces(). */
export const vozDelNavegador = (v: Voz) => crudas.find((c) => c.voiceURI === v.uri);

const SIN_VOCES: Voz[] = [];
/** En el servidor no hay voces (para useSyncExternalStore). */
export const sinVoces = () => SIN_VOCES;

/** Avisa cuando el navegador termina de cargar sus voces o cambian. */
export function alCambiarVoces(aviso: () => void): () => void {
  const s = sintetizador();
  s?.addEventListener("voiceschanged", aviso);
  return () => s?.removeEventListener("voiceschanged", aviso);
}

/** La voz que eligió la persona en este celular, o null si nunca eligió (o modo privado). */
export function vozGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/** Guarda la voz elegida en este celular. false si el celular no pudo guardarla. */
export function guardarVoz(uri: string): boolean {
  try {
    localStorage.setItem(CLAVE, uri);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENTO));
  return true;
}

export function alCambiarVozGuardada(aviso: () => void): () => void {
  const enOtra = (e: StorageEvent) => {
    if (e.key === CLAVE) aviso();
  };
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", enOtra);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", enOtra);
  };
}
