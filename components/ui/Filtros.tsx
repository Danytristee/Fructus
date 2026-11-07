"use client";

import { cn } from "cn";

type Opcion<T extends string> = { valor: T; etiqueta: string; cuenta?: number };

type Props<T extends string> = {
  opciones: Opcion<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiqueta: string;
  className?: string;
};

// Una fila de filtros en píldora: el activo se rellena con el acento. Si no entran en una fila, pasan a la siguiente: ninguna opción
// queda cortada ni escondida detrás de un deslizamiento (en el celular, «Al crédito» quedaba a medias y nadie sabía que había más).
export function Filtros<T extends string>({ opciones, valor, alCambiar, etiqueta, className }: Props<T>) {
  return (
    <div role="group" aria-label={etiqueta} className={cn("flex flex-wrap gap-2", className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              alCambiar(o.valor);
              navigator.vibrate?.(8);
            }}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-4 font-extrabold whitespace-nowrap transition-[background-color,color,transform] duration-200 ease-salida active:scale-95",
              activo ? "bg-acento text-sobre-acento shadow-[0_6px_16px_rgb(var(--sombra-color)/0.18)]" : "vidrio text-texto",
            )}
          >
            {o.etiqueta}
            {o.cuenta !== undefined && (
              <span className={cn("rounded-full px-2 py-0.5 text-sm tabular-nums", activo ? "bg-sobre-acento/20" : "bg-acento/10 text-acento-texto")}>
                {o.cuenta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
