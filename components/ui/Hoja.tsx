"use client";

import { useLayoutEffect, useRef } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";
import { cn } from "cn";

type Props = {
  abierta: boolean;
  alCambiar: (abierta: boolean) => void;
  titulo: string;
  /** Un icono chico al lado del título (por ejemplo, Sparkles en la tarjeta de voz). */
  icono?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

// La única hoja de la app (CLAUDE.md, regla 4): en celular sube desde abajo con un resorte corto; en escritorio se ve centrada.
export function Hoja({ abierta, alCambiar, titulo, icono, children, className }: Props) {
  // Al cerrar, el foco vuelve a lo que la abrió (una fila, un botón). Las hojas de Fructus se abren controladas, sin un «trigger» de Radix, así
  // que Radix no sabe adónde devolverlo y lo dejaba al principio de la página: con el teclado había que recorrer todo otra vez (/chaos
  // 2026-11-09). Se recuerda en un efecto de layout, que corre antes de que la hoja mueva el foco hacia adentro.
  const abrio = useRef<HTMLElement | null>(null);
  const estaba = useRef(false);
  useLayoutEffect(() => {
    if (abierta && !estaba.current) abrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    estaba.current = abierta;
  }, [abierta]);

  return (
    <Sheet open={abierta} onOpenChange={alCambiar}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          if (abrio.current?.isConnected) {
            e.preventDefault();
            abrio.current.focus();
          }
        }}
        className={cn(
          "max-h-[94dvh] gap-0 overflow-y-auto rounded-t-hoja border-0 bg-fondo px-4 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgb(var(--sombra-color)/0.18)]",
          "data-[state=open]:animate-hoja-sube data-[state=closed]:animate-hoja-baja",
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-hoja md:pb-5",
          "md:data-[state=open]:animate-hoja-aparece md:data-[state=closed]:animate-hoja-se-va",
          className,
        )}
      >
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-11 shrink-0 rounded-full bg-borde/60 md:hidden" />
        <div className="mb-3 flex items-center gap-2.5">
          {icono && <span className="grid size-10 place-items-center rounded-xl bg-lima-suave text-acento-texto">{icono}</span>}
          <SheetTitle className="text-[23px] font-extrabold text-texto">{titulo}</SheetTitle>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
