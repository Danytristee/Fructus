"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";
import { abreTeclado, cuentaComoEscrito } from "@/lib/teclado-reglas";
import { cn } from "cn";

import { Boton } from "./Boton";

import { anotarHoja, despuesDeCerrarHoja } from "./historial-hojas";
import { useArrastreHoja } from "./useArrastreHoja";

// Para quien cierra una hoja y enseguida navega (un cliente nuevo se abre en su ficha).
export { despuesDeCerrarHoja };

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
// Se porta como la de un celular: sigue al dedo al deslizarla (useArrastreHoja) y «atrás» la cierra sin salir de la pantalla
// (historial-hojas).
export function Hoja({ abierta, alCambiar, titulo, icono, children, className }: Props) {
  const router = useRouter();
  // Radix monta el contenido un render después de abrir (su Portal espera al montaje): se guarda en estado para que los efectos lo vean.
  const [contenido, setContenido] = useState<HTMLDivElement | null>(null);
  const alCambiarRef = useRef(alCambiar);
  const abiertaRef = useRef(abierta);
  useLayoutEffect(() => {
    alCambiarRef.current = alCambiar;
    abiertaRef.current = abierta;
  });

  // Al cerrar, el foco vuelve a lo que la abrió (una fila, un botón). Las hojas de Fructus se abren controladas, sin un «trigger» de Radix, así
  // que Radix no sabe adónde devolverlo y lo dejaba al principio de la página: con el teclado había que recorrer todo otra vez (/chaos
  // 2026-11-09). Se recuerda en un efecto de layout, que corre antes de que la hoja mueva el foco hacia adentro.
  const abrio = useRef<HTMLElement | null>(null);
  const estaba = useRef(false);
  useLayoutEffect(() => {
    if (abierta && !estaba.current) abrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    estaba.current = abierta;
  }, [abierta]);

  // Lo escrito no se pierde por un roce: si la persona escribió algo (un nombre, un teléfono, un monto; una búsqueda no cuenta), cerrar sin
  // querer (tocar afuera, deslizarla, «atrás», Escape) primero pregunta. Cerrar a propósito (Cancelar, Descartar, después de guardar) lo
  // hace cada pantalla por su cuenta y no pasa por aquí.
  const escrito = useRef(false);
  const [preguntando, setPreguntando] = useState(false);
  // Al cerrarse, la pregunta se va con ella (se ajusta en el render, como recomienda React, no en un efecto).
  const [abiertaAntes, setAbiertaAntes] = useState(abierta);
  if (abierta !== abiertaAntes) {
    setAbiertaAntes(abierta);
    if (!abierta) setPreguntando(false);
  }
  useLayoutEffect(() => {
    if (!abierta) escrito.current = false;
  }, [abierta]);
  useEffect(() => {
    const el = contenido;
    if (!abierta || !el) return;
    const alEscribir = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && cuentaComoEscrito(datosDe(t))) escrito.current = true;
    };
    el.addEventListener("input", alEscribir);
    return () => el.removeEventListener("input", alEscribir);
  }, [abierta, contenido]);

  const pedirCerrar = useCallback(() => {
    if (!escrito.current) {
      alCambiarRef.current(false);
      return;
    }
    setPreguntando(true);
    navigator.vibrate?.(20);
    contenido?.scrollTo({ top: 0, behavior: "smooth" });
  }, [contenido]);

  // «Atrás» cierra la hoja. Si la hoja no se deja cerrar (está guardando), se vuelve a anotar para que el siguiente «atrás» también la
  // pida cerrar, y no saque a la persona de la pantalla con la hoja abierta. Es de layout: el `history.back()` del cierre sale antes que
  // cualquier navegación que venga después.
  const [vuelta, setVuelta] = useState(0);
  useLayoutEffect(() => {
    if (!abierta) return;
    return anotarHoja(() => {
      pedirCerrar();
      window.setTimeout(() => abiertaRef.current && setVuelta((v) => v + 1), 0);
    });
  }, [abierta, vuelta, pedirCerrar]);

  useArrastreHoja(contenido, abierta, pedirCerrar);

  // Un enlace dentro de la hoja (el menú, la ficha de un cliente): primero se cierra la hoja y se quita su página del historial, después
  // se navega. Al revés, «atrás» en la pantalla nueva volvería a la anterior con la hoja cerrada, un toque perdido.
  useEffect(() => {
    const el = contenido;
    if (!abierta || !el) return;
    const alTocarEnlace = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.origin !== window.location.origin || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      // Link de Next mira `defaultPrevented` después de correr su onClick: el onClick de la pantalla sigue corriendo, la navegación no.
      e.preventDefault();
      const destino = a.pathname + a.search + a.hash;
      window.setTimeout(() => {
        alCambiarRef.current(false);
        despuesDeCerrarHoja(() => router.push(destino));
      }, 0);
    };
    el.addEventListener("click", alTocarEnlace, { capture: true });
    return () => el.removeEventListener("click", alTocarEnlace, { capture: true });
  }, [abierta, contenido, router]);

  return (
    <Sheet open={abierta} onOpenChange={(abrir) => (abrir ? alCambiar(true) : pedirCerrar())}>
      <SheetContent
        ref={setContenido}
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        onPointerDownOutside={(e) => {
          // Con el teclado abierto, tocar afuera solo lo baja (como en cualquier app); la hoja sigue ahí con lo escrito.
          const activo = document.activeElement;
          if (activo instanceof HTMLElement && contenido?.contains(activo) && abreTeclado(datosDe(activo))) {
            e.preventDefault();
            activo.blur();
          }
        }}
        onCloseAutoFocus={(e) => {
          if (abrio.current?.isConnected) {
            e.preventDefault();
            abrio.current.focus();
          }
        }}
        className={cn(
          "max-h-[94dvh] scroll-pt-4 scroll-pb-36 gap-0 overflow-y-auto overscroll-y-contain rounded-t-hoja border-0 bg-fondo px-4 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgb(var(--sombra-color)/0.18)]",
          "data-[state=open]:animate-hoja-sube data-[state=closed]:animate-hoja-baja",
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-hoja md:pb-5",
          "md:data-[state=open]:animate-hoja-aparece md:data-[state=closed]:animate-hoja-se-va",
          className,
        )}
      >
        {/* La manija y el título son la «agarradera»: desde ahí la hoja se arrastra siempre, aunque el contenido se deslice. */}
        <div data-asa className="-mx-4 -mt-2.5 mb-3 cursor-grab px-4 pt-2.5 active:cursor-grabbing md:cursor-auto">
          <div aria-hidden className="mx-auto mb-3 h-[5px] w-11 shrink-0 rounded-full bg-borde/60 md:hidden" />
          <div className="flex items-center gap-2.5">
            {icono && <span className="grid size-10 place-items-center rounded-xl bg-lima-suave text-acento-texto">{icono}</span>}
            <SheetTitle className="text-[23px] font-extrabold text-texto">{titulo}</SheetTitle>
          </div>
        </div>
        {preguntando && (
          <div role="alertdialog" aria-labelledby="hoja-sin-guardar" className="mb-4 grid animate-pieza gap-3 rounded-tarjeta border-2 border-deuda/40 bg-superficie p-4">
            <p id="hoja-sin-guardar" className="text-lg font-bold text-texto">
              ¿Cierras sin guardar? Se pierde lo que escribiste.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Boton
                variante="secundario"
                onClick={() => {
                  escrito.current = false;
                  alCambiarRef.current(false);
                }}
              >
                Cerrar sin guardar
              </Boton>
              <Boton onClick={() => setPreguntando(false)}>Seguir aquí</Boton>
            </div>
          </div>
        )}
        {children}
      </SheetContent>
    </Sheet>
  );
}

function datosDe(el: HTMLElement) {
  return { etiqueta: el.tagName, tipo: el.getAttribute("type"), soloLectura: el.hasAttribute("readonly"), editable: el.isContentEditable };
}
