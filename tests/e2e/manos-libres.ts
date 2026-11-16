import type { Page } from "@playwright/test";

// Ayudas para probar la voz sin voz: un micrófono que la prueba prende («habla») y apaga («se calla»), y un sintetizador que anota
// lo que se le pide decir y termina la frase cuando la prueba quiere. Así se controla exactamente cuándo hay voz y cuándo termina
// una lectura (lib/voz/silencio-reglas.ts, lib/voz/manos-libres-reglas.ts).

type Microfono = { hablar: () => void; callar: () => void };
type Voz = { dichas: string[]; terminar: () => void };

/** Reemplaza el micrófono por un tono mudo. Cada pedido de micrófono crea uno nuevo; `hablar` y `callar` mueven el último. */
export async function microfonoControlado(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const tono = ac.createOscillator();
      tono.frequency.value = 220;
      const volumen = ac.createGain();
      volumen.gain.value = 0;
      const destino = ac.createMediaStreamDestination();
      tono.connect(volumen).connect(destino);
      tono.start();
      await ac.resume();
      const microfono: Microfono = {
        hablar: () => volumen.gain.setValueAtTime(0.3, ac.currentTime),
        callar: () => volumen.gain.setValueAtTime(0, ac.currentTime),
      };
      Object.assign(window, { __microfono: microfono });
      return destino.stream;
    };
  });
}

export const hablar = (page: Page) => page.evaluate(() => (window as unknown as { __microfono: Microfono }).__microfono.hablar());
export const callar = (page: Page) => page.evaluate(() => (window as unknown as { __microfono: Microfono }).__microfono.callar());

/** Habla un rato y se calla: una respuesta corta («confirmo»). */
export async function responder(page: Page, ms = 700) {
  await hablar(page);
  await page.waitForTimeout(ms);
  await callar(page);
}

/** Un sintetizador de mentira; con `manosLibres`, además prende el interruptor en este celular. */
export async function sintetizadorDePrueba(page: Page, { manosLibres }: { manosLibres: boolean }) {
  await page.addInitScript((prender) => {
    if (prender) localStorage.setItem("fructus:manos-libres", "si");
    let actual: SpeechSynthesisUtterance | null = null;
    const voz: Voz = {
      dichas: [],
      terminar: () => {
        const u = actual;
        actual = null;
        u?.onend?.(new Event("end") as SpeechSynthesisEvent);
      },
    };
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      voz.dichas.push(u.text);
      actual = u;
    };
    window.speechSynthesis.cancel = () => {
      const u = actual;
      actual = null;
      u?.onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
    };
    Object.assign(window, { __voz: voz });
  }, manosLibres);
}

export const dichas = (page: Page) => page.evaluate(() => (window as unknown as { __voz: Voz }).__voz.dichas);
// En desarrollo React monta la tarjeta dos veces: la primera lectura se corta al instante con la segunda (hablar() calla lo
// anterior), así que se oye una vez. Se cuentan las frases distintas.
export const distintas = async (page: Page) => [...new Set(await dichas(page))];
/** Termina la frase que se está diciendo, como si el sintetizador hubiera llegado al final. */
export const terminarFrase = (page: Page) => page.evaluate(() => (window as unknown as { __voz: Voz }).__voz.terminar());
