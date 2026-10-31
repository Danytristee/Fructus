"use client";

import { cn } from "cn";

import type { Medio } from "@/lib/voz/confirmar-venta-reglas";

type Props = {
  medio: Medio | null;
  alCambiar: (medio: Medio) => void;
  /** Lo que anuncia el lector de pantalla: «¿Con qué pagó?». */
  pregunta: string;
};

const MEDIOS: { valor: Medio; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "transferencia", etiqueta: "Transf." },
];

// Con qué se pagó, a la vista y de un toque: lo usan la venta al contado, el abono y el gasto (una función, una pieza).
export function SelectorMedio({ medio, alCambiar, pregunta }: Props) {
  return (
    <div role="group" aria-label={pregunta} className="grid animate-pieza grid-cols-4 gap-2">
      {MEDIOS.map((m) => (
        <button
          key={m.valor}
          type="button"
          aria-pressed={medio === m.valor}
          onClick={() => alCambiar(m.valor)}
          className={cn(
            "min-h-12 rounded-full px-1 text-base font-extrabold transition-colors duration-200",
            medio === m.valor ? "bg-texto text-superficie" : "bg-superficie text-texto",
          )}
        >
          {m.etiqueta}
        </button>
      ))}
    </div>
  );
}
