"use client";

import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Hoja } from "@/components/ui/Hoja";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { formatearHace, formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { fraseDePago, lineaDeFruta, type DetalleVenta } from "@/lib/ventas-reglas";
import { horaDeLima } from "@/lib/ficha-cliente-reglas";

type Props = { venta: DetalleVenta | null; alCerrar: () => void };

// El detalle de una venta del historial: a quién, qué fruta y a cuánto, cómo se pagó y quién la registró.
export function HojaVenta({ venta, alCerrar }: Props) {
  return (
    <Hoja abierta={venta !== null} alCambiar={(abrir) => !abrir && alCerrar()} titulo="Detalle de la venta" icono={<Receipt aria-hidden />}>
      {venta && <Cuerpo venta={venta} />}
    </Hoja>
  );
}

function Cuerpo({ venta }: { venta: DetalleVenta }) {
  const fecha = new Date(venta.fecha);
  const cuando = `${formatearHace(fecha, new Date())}, ${horaDeLima(fecha)}`;
  return (
    <div className="grid gap-3">
      {venta.cliente ? (
        <Link
          href={`/clientes/${venta.cliente.id}`}
          className="grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] bg-superficie px-3.5 py-3"
        >
          <Avatar iniciales={iniciales(venta.cliente.nombre)} tono={tonoDe(venta.cliente.id)} />
          <span className="grid min-w-0">
            <span className="text-[22px] leading-tight font-extrabold">{venta.cliente.nombre}</span>
            <span className="text-texto-suave">Ver su ficha</span>
          </span>
          <ChevronRight aria-hidden className="size-6 text-texto-suave" />
        </Link>
      ) : (
        <p className="rounded-[20px] bg-superficie px-3.5 py-3 text-[22px] font-extrabold">Venta al paso</p>
      )}

      <div className="mx-1 grid gap-1">
        <Monto valor={venta.total} tamano="total" />
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tipo={venta.condicion === "credito" ? "debe" : "pago"}>{fraseDePago(venta)}</Insignia>
          <span className="text-texto-suave capitalize">{cuando}</span>
        </div>
      </div>

      <ul aria-label="Fruta de la venta" className="divide-y divide-border overflow-hidden rounded-[20px] bg-superficie">
        {venta.items.map((i, n) => {
          const { titulo, detalle } = lineaDeFruta(i, formatearSoles);
          return (
            <li key={n} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3">
              <span className="grid min-w-0">
                <span className="leading-tight font-extrabold">{titulo}</span>
                <span className="text-texto-suave">{detalle}</span>
              </span>
              <Monto valor={i.subtotal} />
            </li>
          );
        })}
      </ul>

      {venta.registradaPor && <p className="mx-1 text-texto-suave">La registró {venta.registradaPor}.</p>}
    </div>
  );
}
