import { cn } from "cn";

import { etiquetaDeLlegada, tonoDeLlegada } from "@/lib/frescura-frases-reglas";

const CLASE = { hoy: "bg-deuda text-superficie", manana: "bg-sol/12 text-sol", bien: "bg-texto/8 text-texto" } as const;

// La etiqueta chica de una llegada: «Sale hoy» (rojo), «Sale mañana» (ámbar) o los días que le quedan. El texto lo dice; el color acompaña.
export function EtiquetaLlegada({ restan, className }: { restan: number; className?: string }) {
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap", CLASE[tonoDeLlegada(restan)], className)}>{etiquetaDeLlegada(restan)}</span>;
}
