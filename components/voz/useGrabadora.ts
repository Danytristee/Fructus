"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * Graba desde que se toca el botón hasta que se termina (soltar o un segundo toque). El micrófono se pide al empezar y se suelta al terminar: la luz de «micrófono
 * en uso» del celular no queda prendida. Si se suelta antes de que el micrófono arranque, la grabación sale vacía.
 *
 * Cada `empezar` tiene su vuelta. Si llega el micrófono de una vuelta que ya no es la vigente (se terminó, o se volvió a
 * tocar mientras el celular preguntaba), se apaga ahí mismo. Con una sola bandera «soltado», un toque nuevo la reiniciaba
 * y el micrófono del toque anterior quedaba prendido sin que nadie lo supiera (/chaos 2026-11-12, A1).
 */
export function useGrabadora() {
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const vuelta = useRef(0);

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
    return null;
  }, []);

  const terminar = useCallback(async (): Promise<Grabacion> => {
    vuelta.current++; // el micrófono que todavía no llegó ya no es de nadie
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
      const g = grabadora.current;
      grabadora.current = null;
      if (g && g.state !== "inactive") g.stop();
      g?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { empezar, terminar };
}
