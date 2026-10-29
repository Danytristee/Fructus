"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

type Props = {
  /** Lo que se ve siempre (la fila). */
  resumen: React.ReactNode;
  /** Lo que aparece al tocar: el «¿por qué?» y el «qué hacer» (ley 6: lo difícil, a un toque). */
  children: React.ReactNode;
  abiertoAlInicio?: boolean;
  className?: string;
};

// Una fila que se despliega con un toque. La altura se anima con grid-template-rows (0fr → 1fr): sin medir en JavaScript.
export function Desplegable({ resumen, children, abiertoAlInicio = false, className }: Props) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-3 text-left transition-transform duration-150 active:scale-[0.99]"
      >
        <span className="min-w-0">{resumen}</span>
        <ChevronDown aria-hidden className={cn("size-6 text-texto-suave transition-transform duration-300 ease-salida", abierto && "rotate-180")} />
      </button>
      <div id={id} className={cn("grid transition-[grid-template-rows] duration-300 ease-salida", abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!abierto}>
          <div className={cn("pt-3 transition-opacity duration-300", abierto ? "opacity-100" : "opacity-0")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
