"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { TarjetaVenta } from "./TarjetaVenta";
import type { ResultadoVoz } from "./VozHoy";

type Props = {
  resultado: ResultadoVoz;
  abierta: boolean;
  /** La hoja se cerró: «guardada» después del sello; «descartada» con Descartar, el velo o deslizando hacia abajo. */
  alCerrar: (motivo: "guardada" | "descartada") => void;
};

// La hoja de lo que se entendió. Por ahora solo las ventas se registran por voz; el resto llega en A6 y A7.
export function HojaVoz({ resultado, abierta, alCerrar }: Props) {
  const { tarjeta } = resultado;
  const esVenta = tarjeta.tipo === "venta";
  // El comando que ya se guardó: si la persona cierra la hoja durante el sello, no es un descarte.
  const guardado = useRef<number | null>(null);
  const cerrar = () => alCerrar(guardado.current === resultado.comandoId ? "guardada" : "descartada");
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && cerrar()}
      titulo={esVenta ? "¿Así fue la venta?" : "Esto llega muy pronto"}
      icono={<Sparkles aria-hidden />}
    >
      {/* La key reinicia la tarjeta con cada comando: nada de una venta anterior queda a medias en la siguiente. */}
      {esVenta ? (
        <TarjetaVenta
          key={resultado.comandoId}
          tarjeta={tarjeta}
          comandoId={resultado.comandoId}
          latenciaMs={resultado.latenciaMs}
          alGuardar={() => {
            guardado.current = resultado.comandoId;
            window.setTimeout(cerrar, 1700); // lo que dura el sello
          }}
          alDescartar={cerrar}
        />
      ) : (
        <div className="grid gap-4">
          <p className="text-lg">Por ahora registro ventas por voz. Los abonos, compras, mermas, gastos y preguntas llegan en unos días.</p>
          <Boton variante="secundario" onClick={() => alCerrar("descartada")}>
            Entendido
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
