"use client";

import { CloudUpload } from "lucide-react";

import { ventasPorEnviar } from "@/lib/cola-tarjetas-reglas";
import { formatearSoles } from "@/lib/formato";
import { useCola } from "./ColaProveedor";

/**
 * Bajo «Vendiste hoy»: las ventas que están en el celular esperando señal. La cifra de arriba viene de la base y todavía no las
 * cuenta; sin esto el dueño no sabía si su total estaba completo (/formidable 2026-11-12). Sin ventas en cola, no se dibuja nada.
 */
export function VentasPorEnviar() {
  const cola = useCola();
  const { cuantas, total } = ventasPorEnviar(cola?.situacion.porEnviar ?? []);
  if (cuantas === 0) return null;
  return (
    <p data-testid="ventas-por-enviar" className="mt-1 flex items-start gap-2 font-bold text-texto">
      <CloudUpload aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
      <span>
        + {cuantas} {cuantas === 1 ? "venta" : "ventas"} por enviar (<span className="cifra">{formatearSoles(total)}</span>): todavía no {cuantas === 1 ? "está sumada" : "están sumadas"}.
      </span>
    </p>
  );
}
