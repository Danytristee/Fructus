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
      {/* La misma cabecera verde que Encabezado, con su forma: al tocar una pantalla no se ve un destello de otro color. */}
      <header
        aria-hidden
        className="relative -mx-4 -mt-[max(16px,env(safe-area-inset-top))] mb-4 flex items-start justify-between gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] lg:mx-0 lg:mt-0 lg:mb-7 lg:px-0 lg:pt-0"
      >
        <div className="absolute inset-x-0 top-0 -bottom-[60px] -z-10 rounded-b-[30px] bg-acento lg:hidden" />
        <div className="grid gap-2 border-l-4 border-lima pl-3.5">
          <div className="h-9 w-40 animate-pulse rounded-xl bg-sobre-acento/15 lg:bg-texto/8" />
          <div className="h-5 w-56 max-w-full animate-pulse rounded-xl bg-sobre-acento/10 lg:bg-texto/6" />
        </div>
        <div className="size-[52px] shrink-0 rounded-full bg-sobre-acento/10 lg:hidden" />
      </header>
      <div className="grid gap-3">
        <Esqueleto className="h-[150px] rounded-protagonista" />
        <Esqueleto className="h-[110px]" />
        <Esqueleto className="h-[260px]" />
      </div>
    </div>
  );
}
