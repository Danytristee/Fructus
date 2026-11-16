import { Esqueleto } from "@/components/ui/Esqueleto";

// Lo que se ve de «Hoy» mientras llega el resumen: la misma forma, sin números.
export function EsqueletoResumen() {
  return (
    <div className="grid gap-2.5 lg:col-span-12 lg:grid-cols-12 lg:items-start lg:gap-4" role="status" aria-label="Cargando tu día">
      <Esqueleto className="h-[262px] rounded-protagonista lg:col-span-7" />
      <Esqueleto className="h-[86px] lg:col-span-5 lg:h-[262px]" />
      <Esqueleto className="h-[106px] lg:hidden" />
    </div>
  );
}

/** El lugar de «Lo último» mientras llega. */
export function EsqueletoUltimas() {
  return (
    <div className="mt-3.5 grid gap-2 lg:mt-0" role="status" aria-label="Cargando lo último">
      <Esqueleto className="h-7 w-32 rounded-full" />
      <Esqueleto className="h-[360px]" />
    </div>
  );
}
