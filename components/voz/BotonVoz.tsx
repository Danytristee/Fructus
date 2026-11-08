import { Mic } from "lucide-react";
import { cn } from "cn";

export type EstadoVoz = "listo" | "escuchando" | "entendiendo";

type Props = Omit<React.ComponentProps<"button">, "children"> & {
  estado: EstadoVoz;
  /** Lo que se lee arriba: «Mantén para hablar», «Te escucho… 0:03», «Entendiendo…». Se anuncia con aria-live. */
  texto: string;
  /** Si la etiqueta se ve. Oculta, el lector de pantalla la sigue leyendo. */
  verTexto?: boolean;
};

const ondas = ["-0.45s", "-0.15s", "-0.6s", "-0.3s", "-0.75s"];

// El orbe de Aurora (ADR-0007). Solo dibuja: grabar, enviar y abrir la tarjeta son de quien lo usa.
export function BotonVoz({ estado, texto, verTexto = true, className, ...props }: Props) {
  return (
    <div className={cn("pointer-events-none grid justify-items-center gap-2", className)}>
      <span
        id="voz-texto"
        aria-live="polite"
        className={cn(
          "vidrio rounded-full px-3.5 py-1 font-extrabold tabular-nums transition-[opacity,translate] duration-200",
          !verTexto && "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        {texto}
      </span>
      <div className="relative">
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
        <button
          type="button"
          data-estado={estado}
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
          <span aria-hidden className={cn("flex h-12 items-center gap-[5px]", estado !== "escuchando" && "opacity-0")}>
            {ondas.map((retraso) => (
              <i
                key={retraso}
                style={{ animationDelay: retraso }}
                className={cn("h-full w-1.5 scale-y-[0.15] rounded-full bg-current", estado === "escuchando" && "animate-onda")}
              />
            ))}
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
          <span className="sr-only">Botón de voz</span>
        </button>
      </div>
    </div>
  );
}
