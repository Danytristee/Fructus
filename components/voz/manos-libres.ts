// Manos libres (ADR-0020): en este celular, Fructus lee cada venta en voz alta antes de guardarla. Se prende al usar audífono: sin
// él, el parlante del celular lo oye todo el puesto. Se recuerda en el celular, no en la cuenta: el dueño puede usarlo en el suyo y el
// ayudante no en el de él. Es comodidad de interfaz: si se borra, solo vuelve a estar apagado. Solo navegador.

const CLAVE = "fructus:manos-libres";
/** Para que el menú se entere en la misma pestaña (el evento «storage» solo llega a las otras): «Hola Fructus» sugiere prenderlo. */
const EVENTO = "fructus:manos-libres";

/** ¿Está prendido en este celular? Sin almacenamiento (modo privado), no. */
export function manosLibres(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "si";
  } catch {
    return false;
  }
}

/** Lo prende o lo apaga en este celular. false si el celular no pudo guardarlo. */
export function cambiarManosLibres(activo: boolean): boolean {
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
export function alCambiarManosLibres(aviso: () => void): () => void {
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

/** El navegador sabe hablar: sin eso, manos libres no tiene sentido y no se ofrece. */
export const puedeHablar = () => typeof window !== "undefined" && "speechSynthesis" in window;
