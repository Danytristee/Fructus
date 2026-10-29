import { cn } from "cn";

// El lugar de una sección mientras carga (con Suspense). Nunca un «Cargando…» suelto.
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("vidrio animate-pulse rounded-tarjeta", className)} />;
}
