"use client";

import { useCallback, useRef } from "react";

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

/**
 * Graba mientras se mantiene el botón. El micrófono se pide al presionar y se suelta al terminar: la luz de «micrófono
 * en uso» del celular no queda prendida. Si se suelta antes de que el micrófono arranque, la grabación sale vacía.
 */
export function useGrabadora() {
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const soltado = useRef(false);

  const empezar = useCallback(async (): Promise<FallaGrabadora | null> => {
    soltado.current = false;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return "no_soportado";
    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      return falla(e);
    }
    // Lo soltó mientras el celular preguntaba por el permiso: no se graba nada.
    if (soltado.current) {
      flujo.getTracks().forEach((t) => t.stop());
      return null;
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
    return null;
  }, []);

  const terminar = useCallback(async (): Promise<Grabacion> => {
    soltado.current = true;
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

  return { empezar, terminar };
}
