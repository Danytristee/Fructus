"use client";

import { Check, Clock } from "lucide-react";
import { cn } from "cn";

import type { Medio } from "@/lib/voz/confirmar-venta-reglas";
import { SelectorMedio } from "./SelectorMedio";

type Condicion = "contado" | "credito";

type Props = {
  condicion: Condicion | null;
  medio: Medio | null;
  alCambiar: (condicion: Condicion, medio: Medio | null) => void;
  /** Cómo se pregunta: en la venta, por el cliente («¿Pagó o lo debe?»); en la compra, por uno mismo («¿La pagaste…?»). */
  textos?: Textos;
};

type Textos = { pregunta: string; contado: string; credito: string; conQue: string };

const DE_VENTA: Textos = { pregunta: "¿Pagó o lo debe?", contado: "Pagó", credito: "Lo debe", conQue: "¿Con qué pagó?" };

// ¿Pagó o lo debe? Nunca se asume contado: si no se dijo, la pregunta va escrita y son dos botones separados, cada uno con
// su color y su icono (en un solo óvalo parecía un campo: /formidable 2026-10-29). Elegido, es una píldora que se desliza
// (ADR-0007), y si pagó se ve con qué: efectivo a la vista, y se cambia de un toque.
export function PagoODebe({ condicion, medio, alCambiar, textos = DE_VENTA }: Props) {
  const elegir = (c: Condicion) => {
    navigator.vibrate?.(10);
    alCambiar(c, c === "contado" ? (medio ?? "efectivo") : null);
  };
  if (condicion === null) {
    return (
      <div role="group" aria-labelledby="pago-pregunta" className="grid gap-2">
        <p id="pago-pregunta" className="mx-1 text-lg font-extrabold">
          {textos.pregunta}
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
              {c === "contado" ? textos.contado : textos.credito}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div role="group" aria-label={textos.pregunta} className="relative grid grid-cols-2 rounded-full bg-superficie p-[5px]">
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
            {c === "contado" ? textos.contado : textos.credito}
          </button>
        ))}
      </div>
      {condicion === "contado" && <SelectorMedio medio={medio} alCambiar={(m) => alCambiar("contado", m)} pregunta={textos.conQue} />}
    </div>
  );
}
