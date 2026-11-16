"use client";

import { useEffect, useRef, useState } from "react";

import {
  CALLADO,
  LEYENDO,
  REPREGUNTA,
  SILENCIO_RESPUESTA_MS,
  TOPE_RESPUESTA_MS,
  VENTANA_RESPUESTA_MS,
  notaManosLibres,
  siguienteManosLibres,
  type EfectoManosLibres,
  type EventoManosLibres,
} from "@/lib/voz/manos-libres-reglas";
import { callar, hablar } from "./hablar";
import { vibrar } from "./senales";
import { useGrabadora } from "./useGrabadora";

// La respuesta pasa por Whisper (con su respaldo): más que esto y se deja para tocar.
const TOPE_ENVIO_MS = 10_000;

/** Lo que el servidor entendió de la respuesta corta. «fallo» si no respondió o no la entendió: nunca se guarda por las dudas. */
async function entenderRespuesta(audio: Blob, duracionMs: number): Promise<"confirmar" | "otra" | "fallo"> {
  const formulario = new FormData();
  formulario.append("audio", audio, audio.type.includes("mp4") ? "respuesta.m4a" : "respuesta.webm");
  formulario.append("duracion_ms", String(duracionMs));
  try {
    const r = await fetch("/api/voz/respuesta", { method: "POST", body: formulario, signal: AbortSignal.timeout(TOPE_ENVIO_MS) });
    const cuerpo = (await r.json().catch(() => null)) as { respuesta?: unknown } | null;
    if (r.ok && (cuerpo?.respuesta === "confirmar" || cuerpo?.respuesta === "otra")) return cuerpo.respuesta;
    console.error("voz: la respuesta no se entendió", { estado: r.status });
  } catch (e) {
    console.error("voz: no se pudo enviar la respuesta", { error: e instanceof Error ? e.name : "desconocido" });
  }
  return "fallo";
}

/**
 * Manos libres en una tarjeta (ADR-0020): lee `lectura` en voz alta, escucha la respuesta corta y, si dice «confirmo», llama a
 * `alConfirmar` (la misma acción que el toque). Las fases y sus reglas viven en lib/voz/manos-libres-reglas.ts; aquí se habla, se
 * abre el micrófono y se envía. Con `lectura` null no hace nada: la tarjeta es la de siempre.
 *
 * `tomarControl`: la persona tocó la tarjeta. Se calla, se apaga el micrófono y lo que llegue del servidor ya no guarda.
 */
export function useManosLibres({ lectura, alConfirmar }: { lectura: string | null; alConfirmar: () => void }) {
  const [estado, setEstado] = useState(() => (lectura ? LEYENDO : CALLADO));
  const actual = useRef(estado);
  const relojes = useRef<number[]>([]);
  // Cada frase y cada escucha tiene su turno: lo que llega de una vieja (una frase cortada, un envío tardío) no cuenta.
  const turno = useRef(0);
  const confirmar = useRef(alConfirmar);
  useEffect(() => {
    confirmar.current = alConfirmar;
  });
  const grabadora = useGrabadora({ alCallarse: () => aplicar({ tipo: "callo" }), silencioMs: SILENCIO_RESPUESTA_MS });

  function aplicar(ev: EventoManosLibres) {
    const r = siguienteManosLibres(actual.current, ev);
    actual.current = r.estado;
    setEstado(r.estado);
    ejecutar(r.efecto);
  }

  function limpiarRelojes() {
    relojes.current.forEach((r) => window.clearTimeout(r));
    relojes.current = [];
  }

  function decir(texto: string) {
    const mio = ++turno.current;
    if (!hablar(texto, (completa) => mio === turno.current && aplicar({ tipo: "leida", completa }))) {
      queueMicrotask(() => mio === turno.current && aplicar({ tipo: "leida", completa: false }));
    }
  }

  async function escuchar() {
    const mio = ++turno.current;
    const falla = await grabadora.empezar();
    if (mio !== turno.current) return;
    if (falla) return aplicar({ tipo: "vencio" }); // sin micrófono no hay respuesta: se toca
    aplicar({ tipo: "abierto" });
    vibrar(20); // como el orbe: la señal para hablar, sin mirar
    relojes.current.push(
      // No empezó a hablar: se deja de escuchar (el silencio deja la tarjeta para tocar).
      window.setTimeout(() => !grabadora.hablo() && aplicar({ tipo: "vencio" }), VENTANA_RESPUESTA_MS),
      // Habló, pero no se calla (ruido de fondo): lo dicho hasta aquí se envía.
      window.setTimeout(() => aplicar({ tipo: "callo" }), TOPE_RESPUESTA_MS),
    );
  }

  async function enviar() {
    limpiarRelojes();
    const mio = ++turno.current;
    const g = await grabadora.terminar();
    const respuesta = g.audio.size === 0 ? "fallo" : await entenderRespuesta(g.audio, g.duracionMs);
    if (mio === turno.current) aplicar({ tipo: "respuesta", respuesta });
  }

  function ejecutar(efecto: EfectoManosLibres) {
    switch (efecto) {
      case "repreguntar":
        return decir(REPREGUNTA);
      case "escuchar":
        return void escuchar();
      case "enviar":
        return void enviar();
      case "descartar":
        limpiarRelojes();
        turno.current++;
        return void grabadora.terminar();
      case "confirmar":
        return confirmar.current();
      case "callar":
        limpiarRelojes();
        turno.current++;
        callar();
        return void grabadora.terminar();
      case "nada":
        return;
    }
  }

  /** Se cerró la tarjeta: se calla lo que se estuviera leyendo y nada de lo pendiente cuenta (el micrófono lo apaga la grabadora). */
  function soltar() {
    turno.current++;
    limpiarRelojes();
    if (actual.current.fase === "leyendo") callar();
  }

  // La lectura empieza apenas se abre la tarjeta. En desarrollo React monta dos veces: el turno deja sin efecto la primera.
  useEffect(() => {
    if (!lectura) return;
    decir(lectura);
    return soltar;
    // Solo al abrir la tarjeta: `decir` cambia en cada render pero lee todo de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectura]);

  return {
    fase: estado.fase,
    nota: notaManosLibres(estado),
    tomarControl: () => aplicar({ tipo: "tocaron" }),
  };
}
