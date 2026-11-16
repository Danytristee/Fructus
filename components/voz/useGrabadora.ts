"use client";

import { useCallback, useEffect, useRef } from "react";

import { CUADRO_MS, OIDO_NUEVO, SILENCIO_PARA_ENVIAR_MS, nivelDb, oir } from "@/lib/voz/silencio-reglas";

export type FallaGrabadora = "sin_permiso" | "sin_microfono" | "no_soportado";

export type Grabacion = { audio: Blob; duracionMs: number };

// Opus en webm es lo más liviano (Chrome de Android); Safari solo graba mp4. Whisper acepta los dos.
const FORMATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function falla(e: unknown): FallaGrabadora {
  const nombre = e instanceof DOMException ? e.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "sin_permiso";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "sin_microfono";
  return "no_soportado";
}

type Opciones = {
  /** Habló y después calló (lib/voz/silencio-reglas.ts). Quien graba decide si eso termina: sin el dedo, sí; manteniendo, no. */
  alCallarse?: () => void;
  /** Cuánto silencio después de hablar cuenta como «se calló»: un dictado tiene pausas para pensar, una respuesta corta no. */
  silencioMs?: number;
};

type Oido = { apagar: () => void; hablo: () => boolean };
const SIN_OIDO: Oido = { apagar: () => {}, hablo: () => false };

/** Mide el volumen del micrófono mientras graba y avisa cuando la persona se calla. Devuelve cómo apagarlo y si ya habló. */
function escucharSilencios(flujo: MediaStream, alCallarse: () => void, silencioMs: number): Oido {
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

/**
 * Graba desde que se toca el botón hasta que se termina (soltar, un segundo toque o callarse sin el dedo encima). El micrófono se pide al empezar y se suelta al terminar: la luz de «micrófono
 * en uso» del celular no queda prendida. Si se suelta antes de que el micrófono arranque, la grabación sale vacía.
 *
 * Cada `empezar` tiene su vuelta. Si llega el micrófono de una vuelta que ya no es la vigente (se terminó, o se volvió a
 * tocar mientras el celular preguntaba), se apaga ahí mismo. Con una sola bandera «soltado», un toque nuevo la reiniciaba
 * y el micrófono del toque anterior quedaba prendido sin que nadie lo supiera (/chaos 2026-11-12, A1).
 */
export function useGrabadora({ alCallarse, silencioMs = SILENCIO_PARA_ENVIAR_MS }: Opciones = {}) {
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const vuelta = useRef(0);
  const oido = useRef<Oido>(SIN_OIDO);
  // El último aviso que pasó quien graba: el oído vive más que un render y no debe llamar a uno viejo.
  const avisar = useRef(alCallarse);
  useEffect(() => {
    avisar.current = alCallarse;
  });

  const empezar = useCallback(async (): Promise<FallaGrabadora | null> => {
    const mia = ++vuelta.current;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return "no_soportado";
    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      return falla(e);
    }
    // Se terminó o se volvió a tocar mientras el celular preguntaba por el permiso: este micrófono no graba nada.
    if (vuelta.current !== mia) {
      flujo.getTracks().forEach((t) => t.stop());
      return null;
    }
    const anterior = grabadora.current;
    oido.current.apagar();
    if (anterior) {
      if (anterior.state !== "inactive") anterior.stop();
      anterior.stream.getTracks().forEach((t) => t.stop());
    }
    const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    const g = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
    trozos.current = [];
    g.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data);
    };
    g.start();
    inicio.current = performance.now();
    grabadora.current = g;
    oido.current = escucharSilencios(flujo, () => avisar.current?.(), silencioMs);
    return null;
  }, [silencioMs]);

  const terminar = useCallback(async (): Promise<Grabacion> => {
    vuelta.current++; // el micrófono que todavía no llegó ya no es de nadie
    oido.current.apagar();
    const g = grabadora.current;
    grabadora.current = null;
    if (!g || g.state === "inactive") return { audio: new Blob(), duracionMs: 0 };
    const duracionMs = Math.round(performance.now() - inicio.current);
    await new Promise<void>((resolve) => {
      g.onstop = () => resolve();
      g.stop();
    });
    g.stream.getTracks().forEach((t) => t.stop());
    return { audio: new Blob(trozos.current, { type: g.mimeType || "audio/webm" }), duracionMs };
  }, []);

  // Se fue de la pantalla con el micrófono escuchando (un toque lo deja abierto sin el dedo): se apaga y no se envía nada.
  useEffect(
    () => () => {
      vuelta.current++;
      oido.current.apagar();
      const g = grabadora.current;
      grabadora.current = null;
      if (g && g.state !== "inactive") g.stop();
      g?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  /** Ya habló algo en esta grabación (para dejar de escuchar a quien no responde). */
  const hablo = useCallback(() => oido.current.hablo(), []);

  return { empezar, terminar, hablo };
}
