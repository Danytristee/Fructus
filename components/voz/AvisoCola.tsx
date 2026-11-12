"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import { useCola } from "@/components/cola/ColaProveedor";
import { queEsLaTarjeta } from "@/lib/cola-tarjetas-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { AvisoVoz } from "./AvisoVoz";
import type { ResultadoVoz } from "./VozHoy";

type Props = { alAbrir: (id: number, resultado: ResultadoVoz) => void };

// Lo que dejó la cola sin conexión para «Hoy» (ADR-0019): los dictados sin señal ya volvieron como tarjetas y esperan a la
// persona (nada se guarda sin que vea lo que se entendió, principio 1), o un dictado que no se entendió. De a uno, en orden.
export function AvisoCola({ alAbrir }: Props) {
  const cola = useCola();
  // La X lo esconde hasta que llegue otra tarjeta: no se pierde nada, sigue en la cola.
  const [escondidas, setEscondidas] = useState(0);
  if (!cola) return null;
  const sinEntender = cola.entradas.find((e) => e.contenido.clase === "audio" && e.estado === "rechazada");
  if (sinEntender) {
    return (
      <AvisoVoz
        tono="error"
        mensaje="Un dictado que guardé sin señal no se entendió. Dilo otra vez."
        cerrar={{ etiqueta: "Borrar ese dictado", alTocar: () => void cola.quitar(sinEntender.id) }}
      />
    );
  }
  const tarjetas = cola.entradas.filter((e) => e.contenido.clase === "por_confirmar");
  const primera = tarjetas[0];
  if (!primera || primera.contenido.clase !== "por_confirmar") return null;
  const { comandoId, tarjeta, latenciaMs } = primera.contenido;
  const n = tarjetas.length;
  if (n <= escondidas) return null;
  return (
    <AvisoVoz
      tono="info"
      mensaje={`Volvió la señal. Confirma ${queEsLaTarjeta(tarjeta)}${n > 1 ? ` (y ${n - 1} más)` : ""}.`}
      accion={{
        etiqueta: "Verlo",
        icono: <Eye aria-hidden className="size-5" />,
        alTocar: () => alAbrir(primera.id, { comandoId, tarjeta: tarjeta as Tarjeta, latenciaMs }),
      }}
      detalle="Si lo cierras, lo verás aquí otra vez."
      cerrar={{ etiqueta: "Después (no se pierde)", alTocar: () => setEscondidas(n) }}
    />
  );
}
