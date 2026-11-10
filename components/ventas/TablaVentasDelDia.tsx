"use client";

import { cn } from "cn";

import { insignias } from "@/components/hoy/FilaOperacion";
import { Fruta } from "@/components/ui/Fruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { horaDeLima } from "@/lib/ficha-cliente-reglas";
import type { Operacion } from "@/lib/operaciones-reglas";

type Props<V extends Operacion> = { ventas: V[]; alAbrir: (v: V) => void; className?: string };

// Las ventas de un día en escritorio (ADR-0015, las tablas de la dirección B): hora, cliente, qué llevó, cómo quedó y cuánto, en columnas
// que se leen de un vistazo. Toda la fila abre el detalle (anular, boleta o factura), igual que en el celular.
export function TablaVentasDelDia<V extends Operacion>({ ventas, alAbrir, className }: Props<V>) {
  return (
    // Columnas de ancho fijo: un nombre o un detalle largo sin espacios no estira la tabla (/chaos 2026-11-09).
    <table className={cn("w-full table-fixed border-collapse border-t border-border text-left", className)}>
      <colgroup>
        <col className="w-[13%]" />
        <col className="w-[27%]" />
        <col className="w-[30%]" />
        <col className="w-[15%]" />
        <col className="w-[15%]" />
      </colgroup>
      <thead className="text-sm">
        <tr className="border-b border-border">
          {["Hora", "Cliente", "Qué llevó", "Cómo quedó"].map((t) => (
            <th key={t} scope="col" className="px-4 py-2.5 font-extrabold tracking-wide whitespace-nowrap text-texto-suave uppercase">
              {t}
            </th>
          ))}
          <th scope="col" className="px-4 py-2.5 text-right font-extrabold tracking-wide text-texto-suave uppercase">
            Monto
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {ventas.map((v) => (
          <tr key={v.clave} className="relative transition-colors duration-150 hover:bg-lima-suave/60 focus-within:bg-lima-suave/60">
            <td className="cifra px-4 py-3 font-semibold whitespace-nowrap text-texto-suave">{horaDeLima(new Date(v.fecha))}</td>
            <td className="px-4 py-3">
              {/* El botón cubre toda la fila (after:inset-0): se toca en cualquier parte, y el lector de pantalla oye a quién. */}
              <button
                type="button"
                onClick={() => alAbrir(v)}
                className="text-left font-extrabold wrap-anywhere after:absolute after:inset-0 focus-visible:outline-none"
              >
                {v.titulo}
              </button>
            </td>
            <td className="px-4 py-3">
              <span className="flex items-center gap-2 text-texto-suave">
                {v.fruta && <Fruta fruta={v.fruta} tamano={28} />}
                <span className="wrap-anywhere">{v.detalle}</span>
              </span>
            </td>
            <td className="px-4 py-3">
              <Insignia tipo={v.estado}>{insignias[v.estado]}</Insignia>
            </td>
            <td className="px-4 py-3 text-right">
              {v.monto !== null &&
                (v.estado === "anulada" ? (
                  <span className="line-through opacity-60">
                    <Monto valor={v.monto} />
                  </span>
                ) : (
                  <Monto valor={v.monto} />
                ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
