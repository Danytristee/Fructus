"use client";

import { Check, Clock } from "lucide-react";
import { cn } from "cn";

import type { Medio } from "@/lib/voz/confirmar-venta-reglas";

type Condicion = "contado" | "credito";

type Props = {
  condicion: Condicion | null;
  medio: Medio | null;
  alCambiar: (condicion: Condicion, medio: Medio | null) => void;
};

const MEDIOS: { valor: Medio; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "transferencia", etiqueta: "Transf." },
];

// ¿Pagó o lo debe? Nunca se asume contado: si no se dijo, la pregunta va escrita y son dos botones separados, cada uno con
// su color y su icono (en un solo óvalo parecía un campo: /formidable 2026-10-29). Elegido, es una píldora que se desliza
// (ADR-0007), y si pagó se ve con qué: efectivo a la vista, y se cambia de un toque.
export function PagoODebe({ condicion, medio, alCambiar }: Props) {
  const elegir = (c: Condicion) => {
    navigator.vibrate?.(10);
    alCambiar(c, c === "contado" ? (medio ?? "efectivo") : null);
  };
  if (condicion === null) {
    return (
      <div role="group" aria-labelledby="pago-pregunta" className="grid gap-2">
        <p id="pago-pregunta" className="mx-1 text-lg font-extrabold">
          ¿Pagó o lo debe?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["contado", "credito"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => elegir(c)}
              className={cn(
                "flex min-h-[58px] items-center justify-center gap-2 rounded-full border-2 bg-superficie text-[19px] font-extrabold transition-transform duration-150 active:scale-[0.97]",
                c === "contado" ? "border-exito text-exito" : "border-deuda text-deuda",
              )}
            >
              {c === "contado" ? <Check aria-hidden className="size-[22px]" /> : <Clock aria-hidden className="size-[22px]" />}
              {c === "contado" ? "Pagó" : "Lo debe"}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div role="group" aria-label="¿Pagó o lo debe?" className="relative grid grid-cols-2 rounded-full bg-superficie p-[5px]">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-[5px] left-[5px] w-[calc(50%-5px)] animate-saltar rounded-full shadow-[0_6px_16px_rgb(0_0_0/0.18)] transition-[translate,background-color] duration-[420ms] ease-resorte [animation-delay:0ms]",
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
