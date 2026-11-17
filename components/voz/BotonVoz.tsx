import { ChevronUp, Ear, Lock, Mic, SendHorizontal, X } from "lucide-react";
import { cn } from "cn";

export type EstadoVoz = "listo" | "escuchando" | "entendiendo";

type Props = Omit<React.ComponentProps<"button">, "children"> & {
  estado: EstadoVoz;
  /** Lo que se lee arriba: «Toca o mantén para hablar», «Te escucho… 0:03», «Entendiendo…». Se anuncia con aria-live. */
  texto: string;
  /** Si la etiqueta se ve. Oculta, el lector de pantalla la sigue leyendo. */
  verTexto?: boolean;
  /** Escucha sin el dedo encima: el orbe dice «Enviar» y el siguiente toque envía. */
  bloqueado?: boolean;
  /** Mientras escucha sin el dedo, «Borrar», junto a la etiqueta: descarta sin enviar. */
  alCancelar?: () => void;
  /** Mientras se mantiene, el candado encima del orbe: cuánto subió el dedo hacia él, de 0 a 1. Sin valor, no se dibuja. */
  candado?: number;
  /** En reposo, está escuchando «Hola Fructus» (actividad 5c): una etiqueta con la oreja lo dice sobre el orbe, sin moverse. */
  escuchaLaFrase?: boolean;
};

const ondas = ["-0.45s", "-0.15s", "-0.6s", "-0.3s", "-0.75s"];

// El orbe de Aurora (ADR-0007). Solo dibuja: grabar, enviar y abrir la tarjeta son de quien lo usa.
export function BotonVoz({ estado, texto, verTexto = true, bloqueado = false, alCancelar, candado, escuchaLaFrase = false, className, ...props }: Props) {
  const enviar = estado === "escuchando" && bloqueado;
  return (
    <div className={cn("pointer-events-none grid justify-items-center gap-2", className)}>
      {/* Nunca más ancha que la pantalla menos sus márgenes: una etiqueta larga se parte en dos líneas en vez de empujar «Borrar» al borde. */}
      <div className="flex max-w-[calc(100vw-2rem)] items-center gap-2">
        {alCancelar && (
          // Arriba, junto a la etiqueta y lejos del orbe: con una caja en la otra mano, «Borrar» no se toca por enviar (/formidable 2026-11-12).
          <button
            type="button"
            onClick={alCancelar}
            className="vidrio-desenfocado pointer-events-auto flex min-h-12 shrink-0 animate-subir items-center gap-1.5 rounded-full pr-4 pl-3 font-extrabold text-texto"
          >
            <X aria-hidden className="size-5" strokeWidth={2.6} />
            Borrar
          </button>
        )}
        <span
          id="voz-texto"
          aria-live="polite"
          className={cn(
            // En una línea se ve como siempre (redonda); en dos, las esquinas no cortan las letras.
            "min-w-0 rounded-3xl bg-acento px-4 py-1.5 text-center font-extrabold text-balance text-sobre-acento tabular-nums shadow-[0_8px_20px_-6px_rgb(var(--sombra-color)/0.5)] transition-[opacity,translate] duration-200",
            !verTexto && "pointer-events-none translate-y-1 opacity-0",
          )}
        >
          {texto}
        </span>
      </div>
      {candado !== undefined && (
        // Encima del orbe, en la dirección del dedo, como el candado de los audios de WhatsApp: llegar aquí deja el orbe escuchando sin
        // el dedo. El lector de pantalla no lo necesita: con teclado, pulsar una vez ya lo deja escuchando.
        <span
          aria-hidden
          data-candado
          className="vidrio-desenfocado grid w-14 animate-subir justify-items-center gap-1 rounded-full py-2.5 text-texto"
        >
          <Lock className="size-6 transition-transform duration-100 ease-out" style={{ transform: `translateY(${-candado * 8}px)` }} strokeWidth={2.4} />
          <ChevronUp className="size-5 text-texto-suave" strokeWidth={2.6} />
        </span>
      )}
      {/* Con la etiqueta de «Hola Fructus» encima del orbe, la de arriba sube un poco para no pisarla. */}
      <div className={cn("relative", escuchaLaFrase && "mt-5")}>
        {/* El resplandor que respira en reposo, detrás del orbe. */}
        <span aria-hidden className="halo pointer-events-none absolute inset-0 rounded-full" />
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {[0, 600, 1200].map((retraso) => (
            <i
              key={retraso}
              style={{ animationDelay: `${retraso}ms` }}
              className={cn(
                "absolute inset-0 rounded-full border-2 border-acento-texto opacity-0",
                estado === "escuchando" && "animate-rizo",
              )}
            />
          ))}
        </span>
        {escuchaLaFrase && (
          // Sobre el borde de arriba del orbe, con palabras: dice que el micrófono está abierto y qué hay que decir. Era una bolita con la
          // oreja y el ciego la tomó por el globito de mensajes de WhatsApp (/formidable 2026-11-16, cambio 2). Al costado no cabe: ahí
          // están los destinos de la barra. No recibe toques: lo que caiga sobre ella llega al orbe o a la pantalla.
          <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-5 z-10 flex justify-center">
            <span
              data-oreja
              className="flex animate-subir items-center gap-1.5 rounded-full border-2 border-fondo bg-lima py-1 pr-3.5 pl-2.5 text-[17px] leading-tight font-extrabold whitespace-nowrap text-sobre-lima"
            >
              <Ear className="size-5" strokeWidth={2.4} />
              Escucho «Hola Fructus»
            </span>
          </span>
        )}
        <button
          type="button"
          data-estado={estado}
          data-bloqueado={bloqueado || undefined}
          data-palabra={escuchaLaFrase || undefined}
          aria-describedby="voz-texto"
          className={cn(
            // Solo el orbe recibe toques: la etiqueta y el contenedor dejan pasar el dedo a la barra de abajo.
            "orbe pointer-events-auto relative grid size-[104px] cursor-pointer touch-none place-items-center rounded-full text-sobre-orbe select-none",
            "transition-transform duration-[250ms] ease-salida *:col-start-1 *:row-start-1",
            estado === "escuchando" && "scale-110",
            estado === "entendiendo" && "scale-[0.96]",
          )}
          {...props}
        >
          <Mic
            aria-hidden
            className={cn("size-11 transition-[opacity,scale] duration-200", estado !== "listo" && "scale-50 opacity-0")}
            strokeWidth={2.2}
          />
          <span aria-hidden className={cn("flex h-12 items-center gap-[5px]", (estado !== "escuchando" || enviar) && "opacity-0")}>
            {ondas.map((retraso) => (
              <i
                key={retraso}
                style={{ animationDelay: retraso }}
                className={cn("h-full w-1.5 scale-y-[0.15] rounded-full bg-current", estado === "escuchando" && !enviar && "animate-onda")}
              />
            ))}
          </span>
          {/* Escuchando sin el dedo, el orbe dice qué hace el siguiente toque; los anillos de alrededor siguen diciendo que escucha. */}
          <span
            aria-hidden
            data-enviar={enviar || undefined}
            className={cn("grid justify-items-center gap-1 transition-[opacity,scale] duration-200", !enviar && "scale-50 opacity-0")}
          >
            <SendHorizontal className="size-8" strokeWidth={2.4} />
            <span className="text-[17px] leading-none font-extrabold">Enviar</span>
          </span>
          <span aria-hidden className={cn("flex gap-1.5", estado !== "entendiendo" && "opacity-0")}>
            {[0, 120, 240].map((retraso) => (
              <i
                key={retraso}
                style={{ animationDelay: `${retraso}ms` }}
                className={cn("size-[9px] rounded-full bg-current", estado === "entendiendo" && "animate-punto")}
              />
            ))}
          </span>
          <span
            aria-hidden
            className={cn(
              "absolute -inset-[9px] rounded-full border-4 border-transparent border-t-acento-texto border-r-acento-texto opacity-0 transition-opacity",
              estado === "entendiendo" && "animate-girar opacity-100",
            )}
          />
          <span className="sr-only">{enviar ? "Enviar lo que dijiste" : escuchaLaFrase ? "Botón de voz (escuchando «Hola Fructus»)" : "Botón de voz"}</span>
        </button>
      </div>
    </div>
  );
}
