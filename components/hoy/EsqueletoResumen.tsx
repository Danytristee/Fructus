import { Esqueleto } from "@/components/ui/Esqueleto";

// Lo que se ve de «Hoy» mientras llega el resumen: la misma forma, sin números.
export function EsqueletoResumen() {
  return (
    <div className="grid gap-2.5" role="status" aria-label="Cargando tu día">
      <Esqueleto className="h-[262px] rounded-protagonista" />
      <Esqueleto className="h-[86px]" />
      <Esqueleto className="h-[106px]" />
    </div>
  );
}

/** El lugar de «Lo último» mientras llega. */
export function EsqueletoUltimas() {
  return (
    <div className="mt-6 grid gap-2" role="status" aria-label="Cargando lo último">
      <Esqueleto className="h-7 w-32 rounded-full" />
      <Esqueleto className="h-[360px]" />
    </div>
  );
}
