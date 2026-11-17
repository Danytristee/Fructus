// «Hola Fructus» (actividad 5c): en este celular, «Hoy» escucha la frase y empieza a grabar sin tocar el orbe. Se recuerda en el
// celular, no en la cuenta, como manos libres: escuchar todo el tiempo gasta batería y la primera vez baja unos 5 MB, así que se
// prende donde se va a usar. Es comodidad de interfaz: si se borra, solo vuelve a estar apagado. Solo navegador.

const CLAVE = "fructus:hola-fructus";
/** El menú lo cambia y «Hoy» lo escucha en la misma pestaña (el evento «storage» solo llega a las otras). */
const EVENTO = "fructus:hola-fructus";

/** ¿Está prendido en este celular? Sin almacenamiento (modo privado), no. */
export function holaFructus(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "si";
  } catch {
    return false;
  }
}

/** Lo prende o lo apaga en este celular y avisa a «Hoy». false si el celular no pudo guardarlo. */
export function cambiarHolaFructus(activo: boolean): boolean {
  try {
    if (activo) localStorage.setItem(CLAVE, "si");
    else localStorage.removeItem(CLAVE);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENTO));
  return true;
}

/** Avisa cada vez que cambia, en esta pestaña o en otra. Para useSyncExternalStore. */
export function alCambiarHolaFructus(aviso: () => void): () => void {
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

/** El navegador puede escuchar la frase: audio en su propio hilo, workers, WebAssembly y micrófono. Sin eso, no se ofrece. */
export const puedeEscuchar = () =>
  typeof window !== "undefined" && "AudioWorkletNode" in window && "Worker" in window && typeof WebAssembly === "object" && !!navigator.mediaDevices?.getUserMedia;
