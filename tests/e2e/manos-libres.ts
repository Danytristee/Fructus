import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// Ayudas para probar la voz sin voz: un micrófono que la prueba prende («habla») y apaga («se calla»), y un sintetizador que anota
// lo que se le pide decir y termina la frase cuando la prueba quiere. Así se controla exactamente cuándo hay voz y cuándo termina
// una lectura (lib/voz/silencio-reglas.ts, lib/voz/manos-libres-reglas.ts).
//
// Lo que «habla» el micrófono es un dictado de verdad en bucle (una voz del Mac, tests/bulla/dictado-venta.wav), no un tono: el oído
// con Silero (lib/voz/fin-de-habla.ts) no toma un tono por voz. La grabación no tiene pausas de más de 150 ms.

/** La voz que «habla» el micrófono: las muestras del WAV (16 bits, 16 kHz), en base64 para pasarlas a la página. */
const VOZ_DE_PRUEBA = (() => {
  const wav = readFileSync("tests/bulla/dictado-venta.wav");
  const datos = wav.indexOf("data");
  return wav.subarray(datos + 8, datos + 8 + wav.readUInt32LE(datos + 4)).toString("base64");
})();

/**
 * Deja lista en la página, al cargar, la voz (`__vozDePrueba`, de -1 a 1) y el contexto de audio del micrófono (`__audioDePrueba`). En
 * Chrome de prueba, el primer contexto de audio de una página traba el hilo de la pantalla hasta un segundo (con la máquina ocupada): si
 * se creaba al tocar, el toque de la prueba (60 ms) llegaba como «mantener y soltar». En un teléfono no pasa: el toque lo mide la pantalla.
 */
async function prepararVoz(page: Page) {
  await page.addInitScript((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    Object.assign(window, { __vozDePrueba: Float32Array.from(pcm, (x) => x / 32768), __audioDePrueba: new AudioContext() });
  }, VOZ_DE_PRUEBA);
}

type Microfono = { hablar: () => void; callar: () => void; motor?: (prendido: boolean) => void };
type Voz = { dichas: string[]; terminar: () => void };

/** Reemplaza el micrófono por una voz muda. Cada pedido de micrófono crea uno nuevo; `hablar` y `callar` mueven el último. */
export async function microfonoControlado(page: Page) {
  await prepararVoz(page);
  await page.addInitScript(() => {
    const { __vozDePrueba: muestras, __audioDePrueba: ac } = window as unknown as { __vozDePrueba: Float32Array<ArrayBuffer>; __audioDePrueba: AudioContext };
    navigator.mediaDevices.getUserMedia = async () => {
      const voz = ac.createBufferSource();
      voz.buffer = ac.createBuffer(1, muestras.length, 16_000);
      voz.buffer.copyToChannel(muestras, 0);
      voz.loop = true;
      const volumen = ac.createGain();
      volumen.gain.value = 0;
      const destino = ac.createMediaStreamDestination();
      voz.connect(volumen).connect(destino);
      voz.start();
      // Un motor (ruido parejo) tan fuerte como la voz: no es voz, pero suena igual que ella.
      const ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * 0.17; // unos -20 dB, como la voz
      const motor = ac.createBufferSource();
      motor.buffer = ruido;
      motor.loop = true;
      const volumenMotor = ac.createGain();
      volumenMotor.gain.value = 0;
      motor.connect(volumenMotor).connect(destino);
      motor.start();
      await ac.resume();
      const microfono: Microfono = {
        hablar: () => volumen.gain.setValueAtTime(1, ac.currentTime),
        callar: () => volumen.gain.setValueAtTime(0, ac.currentTime),
        motor: (prendido) => volumenMotor.gain.setValueAtTime(prendido ? 1 : 0, ac.currentTime),
      };
      Object.assign(window, { __microfono: microfono });
      return destino.stream;
    };
  });
}

/**
 * Un micrófono que «dice» audios de verdad, para «Hola Fructus»: la escucha corre de verdad (worker, onnxruntime-web y los modelos)
 * sobre lo que se le hace oír con `decir`. Cada pedido de micrófono crea uno nuevo, y todo lo que se dice lo oyen todos los que
 * están abiertos, como en el puesto. Tiene además la voz de `hablar` y `callar`, en todos a la vez, para las respuestas cortas.
 */
export async function microfonoQueDice(page: Page) {
  await prepararVoz(page);
  await page.addInitScript(() => {
    const { __vozDePrueba: muestras, __audioDePrueba: ac } = window as unknown as { __vozDePrueba: Float32Array<ArrayBuffer>; __audioDePrueba: AudioContext };
    type Abierto = { ac: AudioContext; destino: MediaStreamAudioDestinationNode; volumen: GainNode };
    const abiertos: Abierto[] = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const destino = ac.createMediaStreamDestination();
      const voz = ac.createBufferSource();
      voz.buffer = ac.createBuffer(1, muestras.length, 16_000);
      voz.buffer.copyToChannel(muestras, 0);
      voz.loop = true;
      const volumen = ac.createGain();
      volumen.gain.value = 0;
      voz.connect(volumen).connect(destino);
      voz.start();
      void ac.resume();
      abiertos.push({ ac, destino, volumen });
      return destino.stream;
    };
    const microfono: Microfono = {
      hablar: () => abiertos.forEach((m) => m.volumen.gain.setValueAtTime(1, m.ac.currentTime)),
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
/** Prende o apaga el motor del micrófono controlado: un ruido tan fuerte como la voz que no es voz. */
export const motor = (page: Page, prendido: boolean) =>
  page.evaluate((p) => (window as unknown as { __microfono: Microfono }).__microfono.motor?.(p), prendido);

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
