"use client";

import { Check, Clock } from "lucide-react";
import { cn } from "cn";

import type { Medio } from "@/lib/voz/confirmar-venta-reglas";

type Condicion = "contado" | "credito";

type Props = {
  condicion: Condicion | null;
  medio: Medio | null;
  alCambiar: (condicion: Condicion, medio: Medio | null) => void;
  /** Falta elegir: se marca con un borde y el texto de arriba lo dice. */
  falta?: boolean;
};

const MEDIOS: { valor: Medio; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "transferencia", etiqueta: "Transf." },
];

// ¿Pagó o lo debe? Dos botones y una píldora que se desliza al elegido (ADR-0007). Nunca se asume contado: si no se dijo,
// la píldora no está y la tarjeta lo pide. Si pagó, se ve con qué (efectivo a la vista, y se cambia de un toque).
export function PagoODebe({ condicion, medio, alCambiar, falta = false }: Props) {
  const elegir = (c: Condicion) => {
    navigator.vibrate?.(10);
    alCambiar(c, c === "contado" ? (medio ?? "efectivo") : null);
  };
  return (
    <div className="grid gap-2">
      <div role="group" aria-label="¿Pagó o lo debe?" className={cn("relative grid grid-cols-2 rounded-full bg-superficie p-[5px]", falta && "ring-2 ring-deuda")}>
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-[5px] left-[5px] w-[calc(50%-5px)] rounded-full shadow-[0_6px_16px_rgb(0_0_0/0.18)] transition-[translate,background-color,opacity] duration-[420ms] ease-resorte",
            condicion === null && "opacity-0",
            condicion === "contado" ? "bg-exito" : "translate-x-full bg-deuda",
          )}
        />
        {(["contado", "credito"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={condicion === c}
            onClick={() => elegir(c)}
            className={cn(
              "relative flex min-h-[58px] items-center justify-center gap-2 rounded-full text-[19px] font-extrabold transition-colors duration-300",
              condicion === c ? "text-superficie" : "text-texto",
            )}
          >
            {c === "contado" ? <Check aria-hidden className="size-[22px]" /> : <Clock aria-hidden className="size-[22px]" />}
            {c === "contado" ? "Pagó" : "Lo debe"}
          </button>
        ))}
      </div>
      {condicion === "contado" && (
        <div role="group" aria-label="¿Con qué pagó?" className="grid animate-pieza grid-cols-4 gap-2">
          {MEDIOS.map((m) => (
            <button
              key={m.valor}
              type="button"
              aria-pressed={medio === m.valor}
              onClick={() => alCambiar("contado", m.valor)}
              className={cn(
                "min-h-12 rounded-full px-1 text-base font-extrabold transition-colors duration-200",
                medio === m.valor ? "bg-texto text-superficie" : "bg-superficie text-texto",
              )}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
