import { Pencil } from "lucide-react";
import { cn } from "cn";

type Props = Omit<React.ComponentProps<"button">, "children"> & {
  icono: React.ReactNode;
  grande: React.ReactNode;
  chico?: React.ReactNode;
  /** Falta este dato: se marca y se anuncia, sin depender solo del color. */
  falta?: boolean;
};

// Un dato de la tarjeta de voz (cliente, fruta): grande para leerlo de un vistazo y tocable para corregirlo.
export function FilaTarjeta({ icono, grande, chico, falta = false, className, ...props }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-[72px] w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] bg-superficie px-3.5 py-3 text-left shadow-[0_2px_10px_rgb(var(--sombra-color)/0.06)]",
        "transition-transform duration-150 ease-out active:scale-[0.98]",
        falta && "ring-2 ring-deuda",
        className,
      )}
      {...props}
    >
      {icono}
      <span className="grid min-w-0 gap-0.5">
        <span className="text-[22px] leading-tight font-extrabold">{grande}</span>
        {chico && <span className="text-texto-suave">{chico}</span>}
      </span>
      <Pencil aria-hidden className="size-[22px] text-texto-suave" />
    </button>
  );
}
