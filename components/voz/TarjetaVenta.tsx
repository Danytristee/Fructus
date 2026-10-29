"use client";

import { Info, UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { formatearCajas, formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { FilaTarjeta } from "./FilaTarjeta";

type Venta = Extract<Tarjeta, { tipo: "venta" }>;

// Lo que se entendió de una venta, en grande (CLAUDE.md, «La voz»): cliente, fruta, cajas, precio y total.
// Lo que se va a guardar se muestra exacto desde el primer cuadro: el total no cuenta.
export function TarjetaVenta({ tarjeta }: { tarjeta: Venta }) {
  const { cliente } = tarjeta;
  return (
    <div className="grid gap-2">
      <FilaTarjeta
        icono={
          cliente.elegido ? (
            <Avatar iniciales={iniciales(cliente.elegido.nombre)} tono={tonoDe(cliente.elegido.id)} />
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-texto/8 text-texto-suave">
              <UserRound aria-hidden />
            </span>
          )
        }
        grande={cliente.elegido?.nombre ?? (cliente.dicho ? `¿${cliente.dicho}?` : "Sin cliente")}
        chico={cliente.elegido ? undefined : cliente.dicho ? "Elige quién es" : "Cliente de paso"}
      />
      {tarjeta.items.map((item, n) => (
        <FilaTarjeta
          key={n}
          icono={<IconoFruta nombre={item.producto.elegido?.nombre ?? item.producto.dicho ?? "?"} tamano={48} />}
          grande={`${formatearCajas(item.cantidad)} de ${item.producto.elegido?.nombre ?? item.producto.dicho ?? "?"}`}
          chico={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="cifra">{item.precio.valor === null ? "Sin precio" : `${formatearSoles(item.precio.valor)} la caja`}</span>
              {item.precio.sugerido && <Insignia tipo="sugerido">sugerido</Insignia>}
            </span>
          }
        />
      ))}
      <div className="mx-1 mt-2 mb-1 flex items-baseline justify-between">
        <span className="text-lg font-bold text-texto-suave">Total</span>
        {tarjeta.total === null ? <span className="text-lg font-bold">Falta el precio</span> : <Monto valor={tarjeta.total} tamano="total" />}
      </div>
      {tarjeta.dudas.map((duda) => (
        <p key={duda} className="mx-1 flex items-start gap-2 text-texto-suave">
          <Info aria-hidden className="mt-1 size-[18px] shrink-0" />
          {duda}
        </p>
      ))}
    </div>
  );
}
