import { cn } from "cn";

// El lugar de una sección mientras carga (con Suspense). Nunca un «Cargando…» suelto.
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("vidrio animate-pulse rounded-tarjeta", className)} />;
}

// Lo que se ve al instante al tocar una pantalla (app/(app)/loading.tsx), antes de que el servidor conteste: el encabezado y tres tarjetas.
// Next lo manda primero y lo precarga con los enlaces de la barra de abajo. Cada pantalla pone después sus propios esqueletos, con su forma.
export function PantallaEsqueleto() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando</span>
      <header aria-hidden className="mb-4 flex items-center justify-between gap-3">
        <div className="grid gap-2">
          <Esqueleto className="h-9 w-40 rounded-xl" />
          <Esqueleto className="h-5 w-60 max-w-full rounded-xl" />
        </div>
        <Esqueleto className="size-[52px] shrink-0 rounded-full" />
      </header>
      <div className="grid gap-3">
        <Esqueleto className="h-[150px] rounded-protagonista" />
        <Esqueleto className="h-[110px]" />
        <Esqueleto className="h-[260px]" />
      </div>
    </div>
  );
}
