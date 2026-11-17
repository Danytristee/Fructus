"use client";

import { ChevronRight, HandCoins } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Monto } from "@/components/ui/Monto";
import { formatearSoles } from "@/lib/formato";
import type { Medio } from "@/lib/voz/confirmar-venta-reglas";
import { SelectorMedio } from "./SelectorMedio";

type Props = {
  /** Lo que pagó al llevarse la fruta; null si todavía no se anotó nada. */
  pagado: number | null;
  medio: Medio | null;
  /** Lo que queda debiendo con esta venta. null mientras falte un precio, o si la tarjeta de deuda del cliente ya lo dice. */
  debe: number | null;
  /** Abre el campo para escribir cuánto pagó. */
  alAnotar: () => void;
  alCambiarMedio: (medio: Medio) => void;
  alQuitar: () => void;
};

// Al crédito, lo que el cliente dejó al llevarse la fruta («pagó solo 1000», ADR-0023). Sin nada anotado es un botón debajo de
// «Lo debe»: lo raro va a un toque y no estorba lo de siempre. Con algo anotado, en grande: cuánto pagó (tocable para cambiarlo),
// con qué, y cuánto queda debiendo, que es lo que el dueño necesita oír antes de confirmar.
export function PagoParcial({ pagado, medio, debe, alAnotar, alCambiarMedio, alQuitar }: Props) {
  if (pagado === null) {
    return (
      <Boton variante="secundario" onClick={alAnotar} className="w-full">
        <span className="flex items-center gap-2">
          <HandCoins aria-hidden />
          Pagó una parte
        </span>
      </Boton>
    );
  }
  // Igual que «Pagó» al contado: el medio a todo el ancho, fuera de una caja. Dentro de una caja del mismo fondo, las opciones sin
  // elegir no se veían como botones y «Efectivo» se cortaba a 360 px.
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={alAnotar}
        className="flex min-h-14 items-center justify-between gap-3 rounded-[20px] bg-superficie px-3.5 text-left"
        aria-label={`Pagó ahora ${formatearSoles(pagado)}. Toca para cambiar cuánto`}
      >
        <span className="text-lg font-bold">Pagó ahora</span>
        <span className="flex items-center gap-1">
          <Monto valor={pagado} tamano="cifra" tono="exito" />
          <ChevronRight aria-hidden className="size-5 text-texto-suave" />
        </span>
      </button>
      <SelectorMedio medio={medio} alCambiar={alCambiarMedio} pregunta="¿Con qué pagó lo que dejó?" />
      {debe !== null && (
        <p className="mx-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-lg font-bold">Queda debiendo</span>
          <Monto valor={debe} tamano="cifra" tono="deuda" />
        </p>
      )}
      <Boton variante="texto" onClick={alQuitar} className="justify-self-start px-1">
        Quitar lo que pagó
      </Boton>
    </div>
  );
}
