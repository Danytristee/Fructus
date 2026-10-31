"use client";

import { cn } from "cn";

type Props<T extends string> = {
  opciones: readonly { valor: T; etiqueta: string }[];
  elegido: T | null;
  alCambiar: (valor: T) => void;
  /** Lo que anuncia el lector de pantalla: «¿Con qué pagó?». */
  pregunta: string;
  columnas: 3 | 4;
};

// Una opción entre pocas, a la vista y de un toque (con qué pagó, en qué se gastó): una función, una pieza.
export function GrupoOpciones<T extends string>({ opciones, elegido, alCambiar, pregunta, columnas }: Props<T>) {
  return (
    <div role="group" aria-label={pregunta} className={cn("grid animate-pieza gap-2", columnas === 3 ? "grid-cols-3" : "grid-cols-4")}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={elegido === o.valor}
          onClick={() => alCambiar(o.valor)}
          className={cn(
            "min-h-12 rounded-full px-1 text-base font-extrabold transition-colors duration-200",
            elegido === o.valor ? "bg-texto text-superficie" : "bg-superficie text-texto",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
