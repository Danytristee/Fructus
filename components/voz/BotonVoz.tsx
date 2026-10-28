import { Mic } from "lucide-react";
import { cn } from "cn";

export type EstadoVoz = "listo" | "escuchando" | "entendiendo";

type Props = Omit<React.ComponentProps<"button">, "children"> & {
  estado: EstadoVoz;
  /** Lo que se lee debajo: «Mantén para hablar», «Te escucho… 0:03», «Entendiendo…». Se anuncia con aria-live. */
  texto: string;
};

const ondas = ["-0.45s", "-0.15s", "-0.6s", "-0.3s", "-0.75s"];

// El orbe de Aurora (ADR-0007). Solo dibuja: grabar, enviar y abrir la tarjeta son de quien lo usa.
export function BotonVoz({ estado, texto, className, ...props }: Props) {
  return (
    <div className={cn("relative grid justify-items-center gap-2", className)}>
      <span aria-hidden className="pointer-events-none absolute top-0 left-1/2 -ml-[52px] size-[104px]">
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
          "orbe relative grid size-[104px] cursor-pointer touch-none place-items-center rounded-full text-sobre-orbe select-none",
          "animate-orbe transition-transform duration-[250ms] ease-salida *:col-start-1 *:row-start-1",
          estado === "escuchando" && "scale-110 animate-orbe-rapido",
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
      <span id="voz-texto" aria-live="polite" className="vidrio rounded-full px-3.5 py-1 font-extrabold tabular-nums">
        {texto}
      </span>
    </div>
  );
}
