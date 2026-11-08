"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

// Por qué rechazaron un comprobante, tal como lo dijo SUNAT o el proveedor: a veces son 200 letras. Se ven las primeras tres líneas y el resto
// queda a un toque («Ver todo»), para que «Emitir» y «Cerrar» no se vayan debajo del borde a 360 px. El texto completo siempre está en
// pantalla al abrirlo: nada se esconde, solo se pliega, y el pliegue solo aparece si de verdad hay algo plegado.
export function MotivoDeRechazo({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const [seCorta, setSeCorta] = useState(false);
  const linea = useRef<HTMLSpanElement>(null);

  // Se mide una vez plegado (y al girar el celular o cambiar el texto): ¿el texto pasa de tres líneas?
  useLayoutEffect(() => {
    const el = linea.current;
    if (!el || abierto) return;
    setSeCorta(el.scrollHeight > el.clientHeight + 1);
  }, [texto, abierto]);

  if (!seCorta) {
    // Cabe en tres líneas (o todavía no se midió): se muestra tal cual, plegado a tres líneas por si acaso.
    return (
      <span ref={linea} className="mt-1 line-clamp-3">
        {texto}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={abierto}
      onClick={() => setAbierto((a) => !a)}
      className="mt-1 -ml-1 grid min-h-12 content-start gap-0.5 rounded-xl px-1 text-left"
    >
      <span ref={linea} className={cn(!abierto && "line-clamp-3")}>
        {texto}
      </span>
      <span className="flex items-center gap-1 font-extrabold text-acento-texto">
        {abierto ? "Ver menos" : "Ver todo"}
        <ChevronDown aria-hidden className={cn("size-5 transition-transform", abierto && "rotate-180")} />
      </span>
    </button>
  );
}
