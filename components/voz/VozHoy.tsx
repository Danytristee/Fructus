"use client";

import { useEffect, useRef, useState } from "react";

import { BotonVoz, type EstadoVoz } from "./BotonVoz";

const TEXTO_LISTO = "Mantén para hablar";
// Marca local del dispositivo: ya usó el botón una vez. Es solo comodidad de interfaz; si se borra, la ayuda vuelve.
const MARCA_APRENDIO = "fructus:voz-aprendida";

/**
 * El botón de voz de «Hoy», encajado al centro de la barra de abajo, en la zona del pulgar (CLAUDE.md, regla 1).
 * Todavía no graba: escucha y entiende con su animación, y al soltar avisa que la voz llega pronto.
 * Grabar con MediaRecorder y enviar a /api/voz es de A4.
 */
export function VozHoy() {
  const [estado, setEstado] = useState<EstadoVoz>("listo");
  const [texto, setTexto] = useState(TEXTO_LISTO);
  const reloj = useRef(0);
  const espera = useRef(0);
  // Arranca oculta: quien ya aprendió no la ve parpadear. Si es su primera vez, aparece enseguida.
  const [aprendio, setAprendio] = useState(true);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      try {
        setAprendio(localStorage.getItem(MARCA_APRENDIO) === "si");
      } catch {
        setAprendio(false); // sin almacenamiento (modo privado): se enseña siempre
      }
    });
    return () => cancelAnimationFrame(cuadro);
  }, []);

  function presionar(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(espera.current);
    try {
      localStorage.setItem(MARCA_APRENDIO, "si");
    } catch {
      // Sin almacenamiento la ayuda seguirá apareciendo; no pasa nada más.
    }
    setAprendio(true);
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
    // Encajado en el centro de la barra de abajo: el orbe asoma por encima y la barra le abre su hueco (data-voz-fijo).
    <div
      data-voz-fijo
      className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex justify-center"
    >
      <BotonVoz
        estado={estado}
        texto={texto}
        // La etiqueta enseña el primer día y acompaña mientras escucha; después no tapa «Lo último» (/formidable 2026-10-28).
        verTexto={!aprendio || estado !== "listo" || texto !== TEXTO_LISTO}
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
  );
}
