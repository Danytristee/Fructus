// Manos libres (ADR-0020): en este celular, Fructus lee cada venta en voz alta antes de guardarla. Se prende al usar audífono: sin
// él, el parlante del celular lo oye todo el puesto. Se recuerda en el celular, no en la cuenta: el dueño puede usarlo en el suyo y el
// ayudante no en el de él. Es comodidad de interfaz: si se borra, solo vuelve a estar apagado. Solo navegador.

const CLAVE = "fructus:manos-libres";

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
    return true;
  } catch {
    return false;
  }
}

/** El navegador sabe hablar: sin eso, manos libres no tiene sentido y no se ofrece. */
export const puedeHablar = () => typeof window !== "undefined" && "speechSynthesis" in window;
