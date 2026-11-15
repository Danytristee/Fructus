"use client";

// Responder hablando (CLAUDE.md, «La voz»): solo en consultas, con speechSynthesis, que viene en el navegador. Se prefiere
// una voz de Perú; si el celular no la tiene, una de Latinoamérica, y si no, cualquiera en español.
const PREFERIDAS = ["es-PE", "es-US", "es-419", "es-MX", "es-CO"];

/**
 * Dice el texto en voz alta, cortando lo que se estuviera diciendo. false si el navegador no sabe hablar. `alTerminar` se llama
 * una vez, cuando termina de decirlo o si no pudo (falló, o lo cortó otra frase o `callar`).
 */
export function hablar(texto: string, alTerminar?: (completo: boolean) => void): boolean {
  const voz = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!voz) return false;
  voz.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  const voces = voz.getVoices();
  const elegida =
    PREFERIDAS.map((l) => voces.find((v) => v.lang.replace("_", "-") === l)).find((v) => v !== undefined) ??
    voces.find((v) => v.lang.toLowerCase().startsWith("es"));
  if (elegida) frase.voice = elegida;
  frase.lang = elegida?.lang ?? "es-PE";
  if (alTerminar) {
    let avisado = false;
    const avisar = (completo: boolean) => {
      if (avisado) return;
      avisado = true;
      alTerminar(completo);
    };
    frase.onend = () => avisar(true);
    // «interrupted» o «canceled»: otra frase o `callar` la cortó. Cualquier otro error, tampoco se dijo entera.
    frase.onerror = () => avisar(false);
  }
  voz.speak(frase);
  return true;
}

export function callar() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
