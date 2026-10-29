"use client";

import { useEffect, useRef, useState } from "react";

import { formatearSoles } from "@/lib/formato";
import { clasesMonto, type PropsMonto } from "./Monto";

// Después de la primera hidratación, una pantalla nueva se arma en el navegador: puede arrancar en 0 sin parpadear.
let yaHidrato = false;

/**
 * Un monto que cuenta desde 0 al abrir la pantalla. Solo para resúmenes («Hoy», cierre), nunca en lo que se va a
 * confirmar: ahí un monto intermedio sería dinero inventado (ADR-0007).
 * - El servidor manda el valor final: sin JavaScript nunca se ve un monto falso.
 * - En la primera carga solo cuenta si React llegó mientras la tarjeta aparece (< 0.8 s); en un celular lento,
 *   saltar del valor final a 0 sería un parpadeo, así que se queda quieto.
 * - El ancho final se reserva para que nada salte; el lector de pantalla y prefers-reduced-motion reciben el valor final.
 */
export function MontoVivo({ valor, ...estilo }: PropsMonto) {
  const [mostrado, setMostrado] = useState(() => (yaHidrato ? 0 : valor));
  const caja = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const primeraCarga = !yaHidrato;
    yaHidrato = true;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches || (primeraCarga && performance.now() > 800);
    let cuadro = 0;
    if (quieto) {
      cuadro = requestAnimationFrame(() => setMostrado(valor));
      return () => cancelAnimationFrame(cuadro);
    }
    const inicio = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / 1100);
      setMostrado(valor * (1 - Math.pow(1 - k, 4)));
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return (
    <span ref={caja} className={clasesMonto(estilo)}>
      {/* Reserva el ancho del valor final: el número crece adentro sin mover nada alrededor. */}
      <span aria-hidden className="invisible block h-0 overflow-hidden">
        {formatearSoles(valor)}
      </span>
      <span aria-hidden>{formatearSoles(mostrado)}</span>
      <span className="sr-only">{formatearSoles(valor)}</span>
    </span>
  );
}
