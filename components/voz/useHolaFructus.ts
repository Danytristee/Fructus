"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { estadoDeEscucha } from "@/lib/voz/escucha-reglas";
import type { MensajeAlWorker, MensajeDelWorker } from "./escucha.worker";
import { alCambiarHolaFructus, holaFructus, puedeEscuchar } from "./hola-fructus";
import type { FallaGrabadora, Grabacion } from "./useGrabadora";
import { usePantallaEncendida } from "./usePantallaEncendida";

// La espera más larga por el WAV del worker: lo arma en milisegundos; si no llega en esto, algo se cayó y no se espera más.
const TOPE_GRABACION_MS = 3000;

const alCambiarVisibilidad = (aviso: () => void) => {
  document.addEventListener("visibilitychange", aviso);
  return () => document.removeEventListener("visibilitychange", aviso);
};
const visible = () => document.visibilityState === "visible";

function fallaDeMicrofono(e: unknown): FallaGrabadora {
  const nombre = e instanceof DOMException ? e.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "sin_permiso";
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "sin_microfono";
  return "no_soportado";
}

type Opciones = {
  hojaAbierta: boolean;
  voz: "listo" | "escuchando" | "entendiendo";
  /** Lo que se escucha ahora empezó con «Hola Fructus». */
  porPalabra: boolean;
  /** Se oyó la frase: lo que sigue ya se está grabando. */
  alDespertar: () => void;
  /** Después de la frase, habló y calló. */
  alCallarse: () => void;
  /** Después de la frase, no dijo nada en 5 s. */
  alMudo: () => void;
  /**
   * La pantalla se ocultó (otra app, el celular bloqueado): se suelta el micrófono, así que lo que se grababa después de la frase ya no
   * sigue. Quien lo usa lo descarta, como al salir de «Hoy» (/chaos 2026-11-16, 2).
   */
  alOcultarse: () => void;
};

/**
 * «Hola Fructus» en «Hoy» (actividad 5c). Con el interruptor prendido abre el micrófono, carga el detector en un worker
 * (components/voz/escucha.worker.ts) y le pasa el audio por un AudioWorklet (public/voz/captura-worklet.js). Cuándo escucha, cuándo
 * pausa y cuándo suelta el micrófono lo decide estadoDeEscucha (lib/voz/escucha-reglas.ts).
 *
 * `atenta`: está buscando la frase de verdad (micrófono abierto, modelos cargados, audio corriendo). `terminar` cierra lo que se grabó
 * después de despertar: el WAV, o null si se tiró o no había nada.
 */
export function useHolaFructus({ hojaAbierta, voz, porPalabra, alDespertar, alCallarse, alMudo, alOcultarse }: Opciones) {
  const activa = useSyncExternalStore(alCambiarHolaFructus, () => holaFructus() && puedeEscuchar(), () => false);
  const pantalla = useSyncExternalStore(alCambiarVisibilidad, visible, () => true);
  const escucha = estadoDeEscucha({ activa, visible: pantalla, hojaAbierta, voz, porPalabra });
  const encendida = escucha !== "apagada";
  // Con el interruptor prendido, en «Hoy», la pantalla no se apaga sola: apagada no hay quién oiga la frase.
  usePantallaEncendida(activa);

  const [cargada, setCargada] = useState(false);
  const [falla, setFalla] = useState<FallaGrabadora | "detector" | null>(null);
  // Con el detector caído nada escucha: el micrófono no se abre, y si estaba abierto se suelta (el punto verde del celular se apaga).
  const conMicrofono = (escucha === "pausada" || escucha === "atenta") && falla !== "detector";
  // El audio corre (el contexto no quedó suspendido esperando un toque, como pide Chrome a veces).
  const [sonando, setSonando] = useState(false);
  const worker = useRef<Worker | null>(null);
  const pendiente = useRef<((g: Grabacion | null) => void) | null>(null);
  const avisos = useRef({ alDespertar, alCallarse, alMudo, alOcultarse });
  useEffect(() => {
    avisos.current = { alDespertar, alCallarse, alMudo, alOcultarse };
  });

  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === "hidden") avisos.current.alOcultarse();
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  // El worker y sus modelos: mientras el interruptor esté prendido (la pantalla oculta no lo apaga, solo suelta el micrófono).
  useEffect(() => {
    if (!encendida) return;
    const w = new Worker(new URL("./escucha.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<MensajeDelWorker>) => {
      const m = e.data;
      if (m.tipo === "listo") setCargada(true);
      else if (m.tipo === "fallo") {
        // Sin los nombres ni lo dicho: solo qué pasó (CLAUDE.md, «Seguridad y claves»).
        console.error("voz: «Hola Fructus» no pudo escuchar", { motivo: m.motivo.slice(0, 160) });
        setFalla("detector");
      } else if (m.tipo === "desperto") avisos.current.alDespertar();
      else if (m.tipo === "callo") avisos.current.alCallarse();
      else if (m.tipo === "mudo") avisos.current.alMudo();
      else if (m.tipo === "sin_silero") console.warn("voz: sin Silero después de «Hola Fructus», se mide el volumen", { motivo: m.motivo });
      else {
        const g = m.tipo === "grabacion" ? { audio: new Blob([m.wav], { type: "audio/wav" }), duracionMs: m.duracionMs, despertar: true as const } : null;
        pendiente.current?.(g);
        pendiente.current = null;
      }
    };
    w.onerror = (e) => {
      console.error("voz: el worker de «Hola Fructus» se cayó", { error: e.message?.slice(0, 160) ?? "desconocido" });
      setFalla("detector");
    };
    return () => {
      w.terminate();
      worker.current = null;
      pendiente.current?.(null);
      pendiente.current = null;
      setCargada(false);
      setFalla(null);
    };
  }, [encendida]);

  // El micrófono y el audio: abiertos mientras «Hoy» se ve (pausado o atento). Se sueltan con la pantalla oculta.
  useEffect(() => {
    if (!conMicrofono) return;
    let vigente = true;
    let flujo: MediaStream | null = null;
    let contexto: AudioContext | null = null;
    const reanudar = () => void contexto?.resume().then(() => vigente && setSonando(contexto?.state === "running"));
    const soltar = () => {
      window.removeEventListener("pointerdown", reanudar, true);
      flujo?.getTracks().forEach((t) => t.stop());
      void contexto?.close().catch(() => {});
    };
    void (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (!vigente) return soltar();
        // A 16 kHz, lo que esperan los modelos: Chrome baja la frecuencia del micrófono solo.
        contexto = new AudioContext({ sampleRate: 16_000 });
        await contexto.audioWorklet.addModule("/voz/captura-worklet.js");
        if (!vigente) return soltar();
        const nodo = new AudioWorkletNode(contexto, "captura-fructus", { numberOfInputs: 1, numberOfOutputs: 0 });
        const canal = new MessageChannel();
        nodo.port.postMessage({ puerto: canal.port1 }, [canal.port1]);
        worker.current?.postMessage({ tipo: "puerto", puerto: canal.port2 } satisfies MensajeAlWorker, [canal.port2]);
        contexto.createMediaStreamSource(flujo).connect(nodo);
        contexto.onstatechange = () => vigente && setSonando(contexto?.state === "running");
        // Chrome deja el audio suspendido si la página todavía no recibió un toque: se reanuda con el primero, en cualquier parte.
        if (contexto.state !== "running") window.addEventListener("pointerdown", reanudar, true);
        reanudar();
      } catch (e) {
        console.error("voz: «Hola Fructus» no pudo abrir el micrófono", { error: e instanceof Error ? e.name : "desconocido" });
        if (vigente) setFalla(fallaDeMicrofono(e));
        soltar();
      }
    })();
    return () => {
      vigente = false;
      soltar();
      setSonando(false);
    };
  }, [conMicrofono]);

  // Buscar la frase o no, según lo que pasa en «Hoy». Al prenderse de nuevo, el worker empieza de cero.
  useEffect(() => {
    if (cargada) worker.current?.postMessage({ tipo: escucha === "atenta" ? "seguir" : "pausar" } satisfies MensajeAlWorker);
  }, [escucha, cargada]);

  const terminar = useCallback(
    (enviar: boolean) =>
      new Promise<Grabacion | null>((resolver) => {
        const w = worker.current;
        if (!w) return resolver(null);
        pendiente.current?.(null);
        const reloj = window.setTimeout(() => {
          pendiente.current = null;
          resolver(null);
        }, TOPE_GRABACION_MS);
        pendiente.current = (g) => {
          window.clearTimeout(reloj);
          resolver(g);
        };
        w.postMessage({ tipo: "terminar", enviar } satisfies MensajeAlWorker);
      }),
    [],
  );

  return { activa, atenta: escucha === "atenta" && cargada && sonando && !falla, falla, terminar };
}
