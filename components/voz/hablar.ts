"use client";

import { elegirVoz, RITMO, type Voz } from "@/lib/voz/voces-reglas";
import { leerVoces, vozDelNavegador, vozGuardada } from "./voces";

// Responder hablando (CLAUDE.md, «La voz»): con speechSynthesis, que viene en el navegador y suena al instante. La voz la elige
// lib/voz/voces-reglas.ts: la que se escogió en el menú de este celular, o la mejor en español que tenga.

/**
 * Dice el texto en voz alta, cortando lo que se estuviera diciendo. false si el navegador no sabe hablar. `alTerminar` se llama
 * una vez, cuando termina de decirlo o si no pudo (falló, o lo cortó otra frase o `callar`).
 */
export function hablar(texto: string, alTerminar?: (completo: boolean) => void, con?: Voz): boolean {
  const voz = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!voz) return false;
  voz.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  const elegida = con ?? elegirVoz(leerVoces(), vozGuardada());
  const delNavegador = elegida && vozDelNavegador(elegida);
  if (delNavegador) frase.voice = delNavegador;
  frase.lang = delNavegador?.lang ?? "es-PE";
  frase.rate = RITMO.velocidad;
  frase.pitch = RITMO.tono;
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
