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

// Elegir DE QUÉ se habla (hoy o 7 días): dos o tres mitades parejas en una sola fila, la elegida en blanco. Se ve distinto de `Filtros`
// (qué parte se muestra) a propósito: en la prueba a ciegas, dos filas de píldoras iguales con un botón oscuro cada una no dejaban saber
// «cuál manda» (/formidable 2026-11-09). Para el lector de pantalla es lo mismo que los filtros: un grupo de botones marcados.
export function Segmento<T extends string>({ opciones, valor, alCambiar, etiqueta, className }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn("grid gap-1 rounded-full bg-texto/6 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
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
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-3 font-extrabold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 ease-salida",
              activo ? "bg-vidrio text-texto shadow-[0_2px_8px_rgb(var(--sombra-color)/0.16)]" : "text-texto-suave",
            )}
          >
            {o.etiqueta}
            {o.cuenta !== undefined && <span className="text-[15px] font-bold tabular-nums text-texto-suave">{o.cuenta}</span>}
          </button>
        );
      })}
    </div>
  );
}
