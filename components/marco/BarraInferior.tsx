"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Package, Receipt, Users } from "lucide-react";
import { cn } from "cn";

// Cuatro destinos como máximo (CLAUDE.md, regla 5). Ajustes y Cierre viven en el menú.
const destinos = [
  { href: "/", nombre: "Hoy", Icono: House },
  { href: "/clientes", nombre: "Clientes", Icono: Users },
  { href: "/stock", nombre: "Stock", Icono: Package },
  { href: "/ventas", nombre: "Ventas", Icono: Receipt },
] as const;

const esActual = (href: string, ruta: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));

export function BarraInferior() {
  const ruta = usePathname();
  const actual = destinos.findIndex((d) => esActual(d.href, ruta));

  return (
    <nav
      aria-label="Principal"
      className="vidrio fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl rounded-[30px] p-1.5 shadow-[0_10px_34px_rgb(var(--sombra-color)/0.14)]"
    >
      {/* Cuatro destinos y, al centro, el hueco del botón de voz cuando la pantalla lo tiene (--hueco-voz en globals.css). */}
      <div className="relative grid grid-cols-[1fr_1fr_var(--hueco-voz)_1fr_1fr]">
        {actual >= 0 && (
          // El fondo del destino actual se desliza con transform (lo mueve el teléfono sin repintar), no con `left`. Su ancho es una cuarta
          // parte de lo que queda sin el hueco de la voz, así que cada paso es 100 % de su propio ancho; pasado el hueco, se suma el hueco.
          <span
            aria-hidden
            style={{
              transform: `translateX(calc(${actual} * 100% + ${actual >= 2 ? 1 : 0} * var(--hueco-voz)))`,
              width: "calc((100% - var(--hueco-voz)) / 4)",
            }}
            className="absolute inset-y-0 left-0 rounded-3xl bg-acento/13 transition-transform duration-[380ms] ease-resorte"
          />
        )}
        {destinos.map(({ href, nombre, Icono }, i) => (
          <Link
            key={href}
            href={href}
            aria-current={i === actual ? "page" : undefined}
            className={cn(
              "relative grid min-h-[60px] place-content-center justify-items-center gap-0.5 text-[13px] font-extrabold transition-[color,transform] duration-150 active:scale-95",
              i === 2 && "col-start-4", // Stock salta el hueco del centro; Ventas lo sigue
              i === actual ? "text-acento-texto" : "text-texto-suave",
            )}
          >
            <Icono aria-hidden className={cn("size-[26px] transition-transform duration-300 ease-salida", i === actual && "scale-110")} />
            {nombre}
          </Link>
        ))}
      </div>
    </nav>
  );
}
