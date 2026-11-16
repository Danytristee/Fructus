import { cn } from "cn";

/**
 * La perilla de un interruptor (encendido / apagado), una sola para toda la app. Es solo el dibujo: quien la usa pone el
 * `role="switch"`, el `aria-checked` y un texto que diga lo mismo, para que el color no sea la única señal.
 */
export function Interruptor({ activo }: { activo: boolean }) {
  return (
    <span aria-hidden className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200", activo ? "bg-exito" : "bg-texto/25")}>
      <span className={cn("absolute top-1 left-1 size-6 rounded-full bg-sobre-acento shadow-sm transition-transform duration-200 ease-salida", activo && "translate-x-6")} />
    </span>
  );
}
