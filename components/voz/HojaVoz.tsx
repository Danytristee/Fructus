"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { TarjetaAbono } from "./TarjetaAbono";
import { TarjetaVenta } from "./TarjetaVenta";
import type { ResultadoVoz } from "./VozHoy";

type Props = {
  resultado: ResultadoVoz;
  abierta: boolean;
  /** La hoja se cerró: «guardada» después del sello; «descartada» con Descartar, el velo o deslizando hacia abajo. */
  alCerrar: (motivo: "guardada" | "descartada", incierto?: boolean) => void;
};

const TITULOS = { venta: "¿Así fue la venta?", abono: "¿Así fue el abono?" } as const;

// La hoja de lo que se entendió. Ventas y abonos se registran por voz; mermas, gastos y compras llegan en A6, y las
// preguntas en A7.
export function HojaVoz({ resultado, abierta, alCerrar }: Props) {
  const { tarjeta } = resultado;
  const soportada = tarjeta.tipo === "venta" || tarjeta.tipo === "abono";
  // El comando que ya se guardó: si la persona cierra la hoja durante el sello, no es un descarte.
  const guardado = useRef<number | null>(null);
  // Mientras guarda no se cierra: deslizar o tocar el velo no puede descartar una venta que está entrando (/chaos).
  const guardando = useRef(false);
  const cerrar = (incierto = false) => {
    if (guardando.current) return;
    alCerrar(guardado.current === resultado.comandoId ? "guardada" : "descartada", incierto);
  };
  // Lo mismo para toda tarjeta: con qué comando, cuánto tardó, y qué hace la hoja al guardar o descartar.
  const comunes = {
    comandoId: resultado.comandoId,
    latenciaMs: resultado.latenciaMs,
    alGuardar: () => {
      guardado.current = resultado.comandoId;
      window.setTimeout(() => cerrar(), 1700); // lo que dura el sello
    },
    alDescartar: cerrar,
    alCambiarGuardando: (g: boolean) => (guardando.current = g),
  };
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && cerrar()}
      titulo={soportada ? TITULOS[tarjeta.tipo] : "Esto llega muy pronto"}
      icono={<Sparkles aria-hidden />}
    >
      {/* La key reinicia la tarjeta con cada comando: nada de una venta anterior queda a medias en la siguiente. */}
      {soportada ? (
        tarjeta.tipo === "venta" ? (
          <TarjetaVenta key={resultado.comandoId} tarjeta={tarjeta} {...comunes} />
        ) : (
          <TarjetaAbono key={resultado.comandoId} tarjeta={tarjeta} {...comunes} />
        )
      ) : (
        <div className="grid gap-4">
          <p className="text-lg">Por ahora registro ventas y abonos por voz. Las compras, mermas, gastos y preguntas llegan en unos días.</p>
          <Boton variante="secundario" onClick={() => alCerrar("descartada")}>
            Entendido
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
