import { cn } from "cn";

type Props = { iniciales: string; tono: number; className?: string };

// La cara de un cliente: sus iniciales sobre su color de siempre (tonoDe en lib/operaciones-reglas.ts).
// Claro: fondo pastel y letra oscura; oscuro: al revés. Contraste de 7:1 o más en los dos.
export function Avatar({ iniciales, tono, className }: Props) {
  return (
    <span
      aria-hidden
      style={{ "--tono": tono } as React.CSSProperties}
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full text-base font-extrabold",
        "bg-[hsl(var(--tono)_80%_88%)] text-[hsl(var(--tono)_70%_18%)]",
        "oscuro:bg-[hsl(var(--tono)_40%_26%)] oscuro:text-[hsl(var(--tono)_80%_92%)]",
        className,
      )}
    >
      {iniciales}
    </span>
  );
}
