"use client";

import { useState } from "react";
import { cn } from "cn";

import { Boton } from "@/components/ui/Boton";
import { seleccionarAlEnfocar } from "@/components/ui/seleccionar-al-enfocar";
import type { LecturaMonto } from "@/lib/voz/monto-reglas";

type Props = {
  /** «¿Cuánto te dio?» */
  etiqueta: string;
  inicial: number | null;
  /** La lectura del monto con su nombre y su tope (leerAbono, leerGasto…). */
  leer: (texto: string) => LecturaMonto;
  alListo: (monto: number) => void;
};

// Corregir un monto de la tarjeta de voz: un campo grande con el teclado de números. Lo escrito que no es un monto se
// dice cómo escribirlo y «Listo» espera: nunca se adivina el número.
export function EditorMonto({ etiqueta, inicial, leer, alListo }: Props) {
  const [texto, setTexto] = useState(inicial === null ? "" : String(inicial));
  const lectura = leer(texto);
  const error = lectura.ok ? null : lectura.error;
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="monto-voz" className="font-bold">
          {etiqueta}
        </label>
        <div
          className={cn(
            "flex min-h-14 items-center gap-2 rounded-control border-2 bg-superficie px-4 focus-within:border-acento",
            error ? "border-deuda" : "border-borde/50",
          )}
        >
          <span className="text-lg font-bold text-texto-suave">S/</span>
          <input
            id="monto-voz"
            inputMode="decimal"
            {...seleccionarAlEnfocar}
            autoComplete="off"
            autoFocus
            value={texto}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "monto-voz-error" : undefined}
            onChange={(e) => setTexto(e.target.value)}
            className="cifra min-h-12 w-full bg-transparent text-2xl font-extrabold outline-none"
          />
        </div>
        {error && (
          <p id="monto-voz-error" role="alert" className="font-bold text-deuda">
            {error}
          </p>
        )}
      </div>
      <Boton onClick={() => lectura.ok && alListo(lectura.valor)} disabled={!lectura.ok}>
        Listo
      </Boton>
    </div>
  );
}
