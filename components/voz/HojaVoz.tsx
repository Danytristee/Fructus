"use client";

import { Sparkles } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { TarjetaVenta } from "./TarjetaVenta";
import type { ResultadoVoz } from "./VozHoy";

type Props = { resultado: ResultadoVoz; abierta: boolean; alCambiar: (abierta: boolean) => void };

// La hoja de lo que se entendió. Por ahora solo las ventas se registran por voz; el resto llega en A6 y A7.
export function HojaVoz({ resultado, abierta, alCambiar }: Props) {
  const { tarjeta } = resultado;
  const esVenta = tarjeta.tipo === "venta";
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo={esVenta ? "¿Así fue la venta?" : "Esto llega muy pronto"} icono={<Sparkles aria-hidden />}>
      {/* La key reinicia la tarjeta con cada comando: nada de una venta anterior queda a medias en la siguiente. */}
      {esVenta ? (
        <TarjetaVenta key={resultado.comandoId} tarjeta={tarjeta} />
      ) : (
        <div className="grid gap-4">
          <p className="text-lg">Por ahora registro ventas por voz. Los abonos, compras, mermas, gastos y preguntas llegan en unos días.</p>
          <Boton variante="secundario" onClick={() => alCambiar(false)}>
            Entendido
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
