"use client";

import { useState } from "react";
import { ChevronRight, Clock, Lightbulb, PackageX, ShoppingCart, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { IconoFruta } from "@/components/ui/IconoFruta";
import type { GrupoAlertas, TipoAlerta } from "@/lib/inventario-reglas";

export const tipos: Record<TipoAlerta, { etiqueta: string; Icono: typeof Clock; clase: string }> = {
  deterioro: { etiqueta: "Por malograrse", Icono: TriangleAlert, clase: "bg-deuda-fondo text-deuda" },
  reponer: { etiqueta: "Reponer", Icono: ShoppingCart, clase: "bg-acento/12 text-acento-texto" },
  sobrestock: { etiqueta: "Te sobra", Icono: PackageX, clase: "bg-exito-fondo text-exito" },
  sin_movimiento: { etiqueta: "Sin movimiento", Icono: Clock, clase: "bg-texto/8 text-texto-suave" },
};

// Cuántas frutas se nombran dentro de una tarjeta que junta varias: el resto, en una hoja. Con el catálogo real una tarjeta llegó a
// nombrar 58 frutas y ocupaba ocho pantallas (2026-11-10).
const FRUTAS_A_LA_VISTA = 3;

type Props = {
  g: GrupoAlertas;
  nombreDe: Map<number, string>;
  i: number;
  /** En lo que tiene que salir: abre el porqué de esa fruta (qué gastó cada día y cuánto le quitó el calor). */
  alVerFruta?: (productoId: number) => void;
};

/** Una tarjeta de «Qué hacer hoy»: una alerta sola, o varias del mismo tipo juntas con una sola recomendación. */
export function TarjetaAlerta({ g, nombreDe, i, alVerFruta }: Props) {
  const [abierta, setAbierta] = useState(false);
  const { Icono, clase } = tipos[g.tipo];
  const sola = g.alertas.length === 1 ? g.alertas[0]! : null;
  const aLaVista = g.alertas.slice(0, FRUTAS_A_LA_VISTA);
  const resto = g.alertas.length - aLaVista.length;
  // Solo lo que tiene que salir tiene un porqué que mostrar: las demás alertas ya dicen su número en la frase.
  const verPorQue = g.tipo === "deterioro" ? alVerFruta : undefined;
  return (
    <li
      data-productos={g.alertas.map((a) => a.productoId).join(" ")}
      className={cn("vidrio grid animate-subir gap-3 rounded-tarjeta p-4", g.gravedad === "alta" && "animate-pulso-alerta")}
      style={{ animationDelay: `${i * 50}ms` }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
        {sola ? (
          <span className="relative">
            <IconoFruta nombre={nombreDe.get(sola.productoId) ?? sola.producto} tamano={44} />
            <span className={cn("absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full ring-2 ring-superficie", clase)}>
              <Icono aria-hidden className="size-3.5" strokeWidth={2.6} />
            </span>
          </span>
        ) : (
          <span className={cn("grid size-11 place-items-center rounded-full", clase)}>
            <Icono aria-hidden className="size-5" strokeWidth={2.4} />
          </span>
        )}
        <span className="grid min-w-0 gap-0.5 wrap-anywhere">
          <span className="leading-tight font-extrabold">{g.titulo}</span>
          {sola ? (
            <>
              <span className="text-base leading-snug text-texto-suave">{g.detalle}</span>
              {verPorQue && (
                <button type="button" onClick={() => verPorQue(sola.productoId)} className="-mb-2 flex min-h-12 items-center gap-0.5 justify-self-start font-extrabold text-acento-texto">
                  ¿Por qué?
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              )}
            </>
          ) : (
            <ul className="mt-1 grid gap-1 text-base leading-snug">
              {aLaVista.map((a) =>
                verPorQue ? (
                  <li key={a.productoId}>
                    <button type="button" onClick={() => verPorQue(a.productoId)} className="flex min-h-12 w-full items-center gap-1 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{a.producto}</span>
                        <span className="text-texto-suave"> · {a.corto}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-suave" />
                    </button>
                  </li>
                ) : (
                  <li key={a.productoId}>
                    <span className="font-bold">{a.producto}</span>
                    <span className="text-texto-suave"> · {a.corto}</span>
                  </li>
                ),
              )}
            </ul>
          )}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap", g.gravedad === "alta" ? "bg-deuda text-superficie" : "bg-texto/8 text-texto")}>
          {/* Lo que se acaba mañana tiene día: «Mañana». Lo demás que puede esperar, «Pronto». */}
          {g.gravedad === "alta" ? "Hoy" : g.tipo === "deterioro" ? "Mañana" : "Pronto"}
        </span>
      </div>
      {resto > 0 && (
        <Boton variante="secundario" className="w-full" onClick={() => setAbierta(true)}>
          <span className="flex items-center gap-1.5">
            Ver las {g.alertas.length} frutas <ChevronRight aria-hidden className="size-5" />
          </span>
        </Boton>
      )}
      <p className="flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
        <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
        <span>{g.recomendacion}</span>
      </p>
      {resto > 0 && (
        <Hoja abierta={abierta} alCambiar={setAbierta} titulo={g.titulo} icono={<Icono aria-hidden className="size-5" />}>
          <ul className="vidrio mt-1 divide-y divide-border overflow-hidden rounded-tarjeta">
            {g.alertas.map((a) => (
              <li key={a.productoId} className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-2.5">
                <IconoFruta nombre={nombreDe.get(a.productoId) ?? a.producto} tamano={36} />
                <span className="grid min-w-0">
                  <span className="leading-tight font-extrabold wrap-anywhere">{a.producto}</span>
                  <span className="text-base leading-snug text-texto-suave">{a.corto}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
            <span>{g.recomendacion}</span>
          </p>
        </Hoja>
      )}
    </li>
  );
}
