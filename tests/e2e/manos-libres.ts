import { readFileSync } from "node:fs";
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

/**
 * Un micrófono que «dice» audios de verdad, para «Hola Fructus»: la escucha corre de verdad (worker, onnxruntime-web y los modelos)
 * sobre lo que se le hace oír con `decir`. Cada pedido de micrófono crea uno nuevo, y todo lo que se dice lo oyen todos los que
 * están abiertos, como en el puesto. Tiene además el tono de `hablar` y `callar`, en todos a la vez, para las respuestas cortas.
 */
export async function microfonoQueDice(page: Page) {
  await page.addInitScript(() => {
    type Abierto = { ac: AudioContext; destino: MediaStreamAudioDestinationNode; volumen: GainNode };
    const abiertos: Abierto[] = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const destino = ac.createMediaStreamDestination();
      const tono = ac.createOscillator();
      tono.frequency.value = 220;
      const volumen = ac.createGain();
      volumen.gain.value = 0;
      tono.connect(volumen).connect(destino);
      tono.start();
      void ac.resume();
      abiertos.push({ ac, destino, volumen });
      return destino.stream;
    };
    const microfono: Microfono = {
      hablar: () => abiertos.forEach((m) => m.volumen.gain.setValueAtTime(0.3, m.ac.currentTime)),
      callar: () => abiertos.forEach((m) => m.volumen.gain.setValueAtTime(0, m.ac.currentTime)),
    };
    Object.assign(window, { __microfono: microfono, __abiertos: abiertos });
  });
}

/** Le hace oír un audio (WAV) a todos los micrófonos abiertos y espera a que termine. */
export async function decir(page: Page, ruta: string) {
  const datos = readFileSync(ruta).toString("base64");
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const abiertos = (window as unknown as { __abiertos: { ac: AudioContext; destino: MediaStreamAudioDestinationNode }[] }).__abiertos;
    await Promise.all(
      abiertos.map(async ({ ac, destino }) => {
        await ac.resume();
        const fuente = ac.createBufferSource();
        fuente.buffer = await ac.decodeAudioData(bytes.slice().buffer);
        fuente.connect(destino);
        await new Promise<void>((listo) => {
          fuente.onended = () => listo();
          fuente.start();
        });
      }),
    );
  }, datos);
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
