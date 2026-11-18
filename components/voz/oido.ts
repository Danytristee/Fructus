"use client";

// El oído de una grabación: avisa cuando la persona habló y cuando se calló. Lo usa components/voz/useGrabadora.ts mientras graba con
// el toque o espera una respuesta de manos libres. Primero con Silero en un worker (components/voz/oido.worker.ts); si eso no se puede,
// con el volumen medido en la pantalla. Nunca se queda sin oído por una falla de Silero.

import { CUADRO_MS, OIDO_NUEVO, nivelDb, oir } from "@/lib/voz/silencio-reglas";

import type { MensajeAlOido, MensajeDelOido } from "./oido.worker";

export type Oido = { apagar: () => void; hablo: () => boolean };
export const SIN_OIDO: Oido = { apagar: () => {}, hablo: () => false };

/**
 * El respaldo: mide el volumen del micrófono en la pantalla y avisa cuando la persona se calla (lib/voz/silencio-reglas.ts, sin Silero).
 * Se usa si el oído con Silero no pudo abrirse.
 */
function escucharPorVolumen(flujo: MediaStream, alCallarse: () => void, silencioMs: number): Oido {
  try {
    const contexto = new AudioContext();
    const analizador = contexto.createAnalyser();
    analizador.fftSize = 1024; // ~21 ms de audio a 48 kHz: el volumen de ese instante
    contexto.createMediaStreamSource(flujo).connect(analizador);
    void contexto.resume().catch(() => {});
    const muestras = new Float32Array(analizador.fftSize);
    let oido = OIDO_NUEVO;
    let hablo = false;
    // Con la pantalla en segundo plano el reloj se frena a una vez por segundo: así tarda más en enviar, nunca antes.
    const reloj = window.setInterval(() => {
      analizador.getFloatTimeDomainData(muestras);
      const r = oir(oido, nivelDb(muestras), silencioMs);
      oido = r.oido;
      hablo ||= r.vozMs > 0;
      if (r.termino) alCallarse();
    }, CUADRO_MS);
    return {
      apagar: () => {
        window.clearInterval(reloj);
        void contexto.close().catch(() => {});
      },
      hablo: () => hablo,
    };
  } catch (e) {
    // Sin el oído se envía como antes: con un toque o a los 55 s. No se pierde nada de lo dicho.
    console.warn("voz: no se pudo medir el silencio", { error: e instanceof Error ? e.name : "desconocido" });
    return SIN_OIDO;
  }
}

/** El worker de Silero (components/voz/oido.worker.ts): uno para todas las grabaciones, creado la primera vez que se graba. */
let oidoCompartido: Worker | null = null;
/** El worker se cayó o no se pudo crear: desde ahí, el volumen. */
let oidoRoto = false;
let ultimaEscucha = 0;
const atentos = new Map<number, { alCallarse: () => void; alHablar: () => void; alRomperse: () => void }>();

function oidoConSilero(): Worker | null {
  if (oidoRoto) return null;
  if (oidoCompartido) return oidoCompartido;
  try {
    const w = new Worker(new URL("./oido.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<MensajeDelOido>) => {
      const m = e.data;
      if (m.tipo === "sin_silero") return console.warn("voz: sin Silero, se mide el volumen", { motivo: m.motivo });
      const a = atentos.get(m.escucha);
      if (m.tipo === "callo") a?.alCallarse();
      else a?.alHablar();
    };
    w.onerror = (e) => {
      console.error("voz: el oído con Silero se cayó; se mide el volumen", { error: e.message?.slice(0, 160) ?? "desconocido" });
      oidoRoto = true;
      oidoCompartido = null;
      w.terminate();
      for (const a of [...atentos.values()]) a.alRomperse();
    };
    oidoCompartido = w;
    return w;
  } catch (e) {
    console.warn("voz: no se pudo crear el oído con Silero; se mide el volumen", { error: e instanceof Error ? e.name : "desconocido" });
    oidoRoto = true;
    return null;
  }
}

/**
 * Oye la grabación con Silero (lib/voz/fin-de-habla.ts): el micrófono pasa a 16 kHz por un AudioWorklet (public/voz/captura-worklet.js)
 * y de ahí, sin tocar la pantalla, al worker. Si algo de eso falla, sigue con el volumen (escucharPorVolumen).
 */
export function escucharConSilero(flujo: MediaStream, alCallarse: () => void, silencioMs: number): Oido {
  const oido = oidoConSilero();
  if (!oido) return escucharPorVolumen(flujo, alCallarse, silencioMs);
  const id = ++ultimaEscucha;
  let hablo = false;
  let apagado = false;
  let contexto: AudioContext | null = null;
  let respaldo: Oido | null = null;
  const pasarAlVolumen = () => {
    if (apagado || respaldo) return;
    atentos.delete(id);
    void contexto?.close().catch(() => {});
    respaldo = escucharPorVolumen(flujo, alCallarse, silencioMs);
  };
  atentos.set(id, { alCallarse, alHablar: () => (hablo = true), alRomperse: pasarAlVolumen });
  void (async () => {
    try {
      contexto = new AudioContext({ sampleRate: 16_000 });
      await contexto.audioWorklet.addModule("/voz/captura-worklet.js");
      // Se terminó mientras se preparaba: no se oye nada (apagar ya cerró el contexto).
      if (apagado) return;
      const nodo = new AudioWorkletNode(contexto, "captura-fructus", { numberOfInputs: 1, numberOfOutputs: 0 });
      const canal = new MessageChannel();
      nodo.port.postMessage({ puerto: canal.port1 }, [canal.port1]);
      oido.postMessage({ tipo: "escuchar", escucha: id, puerto: canal.port2, silencioMs } satisfies MensajeAlOido, [canal.port2]);
      contexto.createMediaStreamSource(flujo).connect(nodo);
      await contexto.resume();
    } catch (e) {
      if (apagado) return;
      console.warn("voz: no se pudo abrir el oído con Silero; se mide el volumen", { error: e instanceof Error ? e.name : "desconocido" });
      pasarAlVolumen();
    }
  })();
  return {
    apagar: () => {
      apagado = true;
      atentos.delete(id);
      oidoCompartido?.postMessage({ tipo: "soltar", escucha: id } satisfies MensajeAlOido);
      void contexto?.close().catch(() => {});
      respaldo?.apagar();
    },
    hablo: () => hablo || (respaldo?.hablo() ?? false),
  };
}
