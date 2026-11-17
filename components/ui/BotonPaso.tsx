"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";

import { esperaDelPaso } from "@/lib/paso-reglas";
import { cn } from "cn";

type Props = {
  signo: "mas" | "menos";
  /** Lo que lee el lector de pantalla: «Una caja más». */
  etiqueta: string;
  alPasar: () => void;
  disabled?: boolean;
  className?: string;
};

// El «+» y el «−» de una cantidad (cajas, grados): un toque es un paso; mantener apretado sigue sumando y cada vez más rápido
// (`lib/paso-reglas.ts`), como en el celular. Cada paso vibra corto, para contar sin mirar. Al llegar al límite (disabled) se detiene solo.
export function BotonPaso({ signo, etiqueta, alPasar, disabled, className }: Props) {
  const pasar = useRef(alPasar);
  useEffect(() => {
    pasar.current = alPasar;
  });
  const reloj = useRef<number | null>(null);
  const repitio = useRef(false);

  function parar() {
    if (reloj.current !== null) window.clearTimeout(reloj.current);
    reloj.current = null;
  }

  function paso() {
    navigator.vibrate?.(8);
    pasar.current();
  }

  function repetir(n: number) {
    reloj.current = window.setTimeout(() => {
      repitio.current = true;
      paso();
      repetir(n + 1);
    }, esperaDelPaso(n));
  }

  // Al llegar al límite el botón se apaga, y un botón apagado ya no avisa que se soltó el dedo: se para aquí.
  useEffect(() => {
    if (disabled) parar();
  }, [disabled]);
  useEffect(() => parar, []);

  const Icono = signo === "mas" ? Plus : Minus;
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        repitio.current = false;
        parar();
        repetir(0);
      }}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // El toque corto suma aquí (también con el teclado); si se mantuvo, ya sumó mientras estaba apretado.
        if (repitio.current) {
          repitio.current = false;
          return;
        }
        paso();
      }}
      className={cn("grid size-14 touch-manipulation place-items-center rounded-full bg-superficie transition-transform active:scale-95 disabled:opacity-40", className)}
    >
      <Icono aria-hidden />
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
}
