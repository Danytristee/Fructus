import { cn } from "cn";

import { frutaIlustrada } from "@/lib/frutas";
import { Fruta } from "./Fruta";

// La fruta dibujada si existe; si no, su inicial en un círculo con su color de siempre. Decorativo: el nombre va al lado.
export function IconoFruta({ nombre, tamano = 44, className }: { nombre: string; tamano?: number; className?: string }) {
  const fruta = frutaIlustrada(nombre);
  if (fruta) return <Fruta fruta={fruta} tamano={tamano} className={className} />;
  // El color sale de la fruta (la primera palabra), no del nombre completo: «Caqui Super» y «Caqui 2da» van del mismo color.
  const tono = [...(nombre.trim().split(/\s+/)[0] ?? "").toLowerCase()].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden
      style={{ width: tamano, height: tamano, "--tono": tono } as React.CSSProperties}
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-lg font-extrabold",
        "bg-[hsl(var(--tono)_70%_86%)] text-[hsl(var(--tono)_70%_20%)] oscuro:bg-[hsl(var(--tono)_35%_26%)] oscuro:text-[hsl(var(--tono)_80%_90%)]",
        className,
      )}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
