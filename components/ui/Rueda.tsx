"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "cn";

import { vibrar } from "@/components/voz/senales";

type Opcion<T> = { valor: T; etiqueta: string };

type Props<T> = {
  opciones: readonly Opcion<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  /** Qué se elige («Hora», «Minutos»): lo dice el lector de pantalla. */
  etiqueta: string;
  className?: string;
};

/** Alto de cada posición. Se ven 5: la elegida al centro y dos arriba y dos abajo, que se desvanecen y giran como en un tambor. */
export const ALTO_DE_LA_RUEDA = 52;
const RELLENO = ALTO_DE_LA_RUEDA * 2;

// Una rueda para elegir girando con el dedo, como el reloj del iPhone: se desliza, se detiene sola en una posición (scroll-snap) y la del
// centro es la elegida. El giro de tambor lo hace el navegador con una animación atada al scroll (`rueda-item` en globals.css): solo
// `transform` y `opacity`, nada corre cuando la rueda está quieta (ADR-0012). Donde el navegador no la tiene, la rueda queda plana y
// los bordes se desvanecen igual. Con el teclado: flechas, Inicio y Fin (role="spinbutton"). Tocar una posición la lleva al centro.
// La franja que marca el centro la dibuja quien la usa, detrás: así dos ruedas lado a lado comparten una sola franja.
export function Rueda<T>({ opciones, valor, alCambiar, etiqueta, className }: Props<T>) {
  const lista = useRef<HTMLDivElement>(null);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  // La posición que la rueda ya informó: así un valor que llega de afuera (teclado, toque) se distingue del que vino del dedo.
  const informado = useRef(indice);
  // Mientras la rueda gira sola hacia un valor (teclado, toque), las posiciones por las que pasa no se informan: si se informaran, el
  // valor retrocedería y varias flechas seguidas se perderían (6 toques daban 3 pasos).
  const destino = useRef<number | null>(null);

  // Al abrir, la rueda aparece ya en su lugar, sin girar.
  useLayoutEffect(() => {
    if (lista.current) lista.current.scrollTop = indice * ALTO_DE_LA_RUEDA;
    // Solo al montar: después manda el dedo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un valor nuevo que no vino del dedo: la rueda gira hasta él.
  useEffect(() => {
    const el = lista.current;
    if (!el || Math.round(el.scrollTop / ALTO_DE_LA_RUEDA) === indice) return;
    informado.current = indice;
    destino.current = indice;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: indice * ALTO_DE_LA_RUEDA, behavior: quieto ? "auto" : "smooth" });
    // Donde no existe `scrollend`, o si el dedo interrumpe el giro, la rueda vuelve a escuchar al dedo a los 700 ms.
    const suelta = window.setTimeout(() => (destino.current = null), 700);
    return () => window.clearTimeout(suelta);
  }, [indice]);

  const posicion = () => {
    const el = lista.current;
    return el ? Math.min(opciones.length - 1, Math.max(0, Math.round(el.scrollTop / ALTO_DE_LA_RUEDA))) : null;
  };

  const alDeslizar = () => {
    const i = posicion();
    if (i === null) return;
    if (destino.current !== null) {
      if (i === destino.current) destino.current = null; // llegó
      return;
    }
    if (i === informado.current) return;
    informado.current = i;
    vibrar(6); // un «clic» en cada posición, como una rueda de verdad (donde el teléfono vibra)
    alCambiar(opciones[i]!.valor);
  };

  const mover = (paso: number) => {
    const i = Math.min(opciones.length - 1, Math.max(0, indice + paso));
    if (i !== indice) alCambiar(opciones[i]!.valor);
  };

  return (
    <div
      ref={lista}
      role="spinbutton"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuenow={indice}
      aria-valuemin={0}
      aria-valuemax={opciones.length - 1}
      aria-valuetext={opciones[indice]?.etiqueta}
      onScroll={alDeslizar}
      onScrollEnd={() => {
        // Se detuvo: lo que quedó al centro es lo elegido, aunque el giro solo se haya interrumpido a medio camino.
        destino.current = null;
        alDeslizar();
      }}
      onKeyDown={(e) => {
        const pasos: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3, Home: -opciones.length, End: opciones.length };
        const paso = pasos[e.key];
        if (paso === undefined) return;
        e.preventDefault();
        mover(paso);
      }}
      style={{ height: ALTO_DE_LA_RUEDA * 5, paddingBlock: RELLENO, scrollPaddingBlock: RELLENO }}
      className={cn(
        "relative snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "[mask-image:linear-gradient(to_bottom,transparent,black_32%,black_68%,transparent)]",
        className,
      )}
    >
      {opciones.map((o, i) => (
        <div
          key={String(o.valor)}
          aria-hidden
          onClick={() => alCambiar(o.valor)}
          style={{ height: ALTO_DE_LA_RUEDA }}
          className={cn(
            "rueda-item grid cursor-pointer snap-center place-items-center text-[32px] font-extrabold tabular-nums select-none",
            i === indice ? "text-texto" : "text-texto-suave",
          )}
        >
          {o.etiqueta}
        </div>
      ))}
    </div>
  );
}
