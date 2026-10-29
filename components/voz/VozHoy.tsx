"use client";

import { useRef, useState } from "react";

import { BotonVoz, type EstadoVoz } from "./BotonVoz";

const TEXTO_LISTO = "Mantén para hablar";

/**
 * El botón de voz de «Hoy», fijo abajo al centro, en la zona del pulgar (CLAUDE.md, regla 1).
 * Todavía no graba: escucha y entiende con su animación, y al soltar avisa que la voz llega pronto.
 * Grabar con MediaRecorder y enviar a /api/voz es de A4.
 */
export function VozHoy() {
  const [estado, setEstado] = useState<EstadoVoz>("listo");
  const [texto, setTexto] = useState(TEXTO_LISTO);
  const reloj = useRef(0);
  const espera = useRef(0);

  function presionar(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(espera.current);
    setEstado("escuchando");
    navigator.vibrate?.(20);
    const inicio = Date.now();
    setTexto("Te escucho… 0:00");
    reloj.current = window.setInterval(() => {
      setTexto(`Te escucho… 0:${String(Math.floor((Date.now() - inicio) / 1000)).padStart(2, "0")}`);
    }, 250);
  }

  function soltar() {
    if (estado !== "escuchando") return;
    window.clearInterval(reloj.current);
    setEstado("entendiendo");
    setTexto("Entendiendo…");
    espera.current = window.setTimeout(() => {
      setEstado("listo");
      setTexto("La voz llega muy pronto");
      espera.current = window.setTimeout(() => setTexto(TEXTO_LISTO), 2500);
    }, 700);
  }

  return (
    <>
      {/* El contenido se desvanece detrás del botón: nada choca con él. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(250px+env(safe-area-inset-bottom))] bg-gradient-to-b from-transparent to-fondo to-60%"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex justify-center">
        <BotonVoz
          estado={estado}
          texto={texto}
          className="pointer-events-auto"
          onPointerDown={presionar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTexto("La voz llega muy pronto");
            }
          }}
        />
      </div>
    </>
  );
}
