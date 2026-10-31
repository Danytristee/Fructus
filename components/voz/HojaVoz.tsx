"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { TarjetaAbono } from "./TarjetaAbono";
import { TarjetaCompra } from "./TarjetaCompra";
import { TarjetaGasto } from "./TarjetaGasto";
import { TarjetaMerma } from "./TarjetaMerma";
import { TarjetaVenta } from "./TarjetaVenta";
import type { ResultadoVoz } from "./VozHoy";

type Props = {
  resultado: ResultadoVoz;
  abierta: boolean;
  /** La hoja se cerró: «guardada» después del sello; «descartada» con Descartar, el velo o deslizando hacia abajo. */
  alCerrar: (motivo: "guardada" | "descartada", incierto?: boolean) => void;
};

const TITULOS: Partial<Record<ResultadoVoz["tarjeta"]["tipo"], string>> = {
  venta: "¿Así fue la venta?",
  abono: "¿Así fue el abono?",
  merma: "¿Así fue la merma?",
  gasto: "¿Así fue el gasto?",
  compra: "¿Así fue la compra?",
};

type Comunes = {
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
};

/** La tarjeta de cada operación que se registra por voz (las que tienen título en TITULOS). */
function TarjetaDe({ tarjeta, comunes }: { tarjeta: ResultadoVoz["tarjeta"]; comunes: Comunes }) {
  switch (tarjeta.tipo) {
    case "venta":
      return <TarjetaVenta tarjeta={tarjeta} {...comunes} />;
    case "abono":
      return <TarjetaAbono tarjeta={tarjeta} {...comunes} />;
    case "merma":
      return <TarjetaMerma tarjeta={tarjeta} {...comunes} />;
    case "gasto":
      return <TarjetaGasto tarjeta={tarjeta} {...comunes} />;
    case "compra":
      return <TarjetaCompra tarjeta={tarjeta} {...comunes} />;
    default:
      return null;
  }
}

// La hoja de lo que se entendió. Ventas, abonos, compras, mermas y gastos se registran por voz; las preguntas llegan en A7.
export function HojaVoz({ resultado, abierta, alCerrar }: Props) {
  const { tarjeta } = resultado;
  // El comando que ya se guardó: si la persona cierra la hoja durante el sello, no es un descarte.
  const guardado = useRef<number | null>(null);
  // Mientras guarda no se cierra: deslizar o tocar el velo no puede descartar una venta que está entrando (/chaos).
  const guardando = useRef(false);
  const cerrar = (incierto = false) => {
    if (guardando.current) return;
    alCerrar(guardado.current === resultado.comandoId ? "guardada" : "descartada", incierto);
  };
  // Lo mismo para toda tarjeta: con qué comando, cuánto tardó, y qué hace la hoja al guardar o descartar.
  const comunes: Comunes = {
    comandoId: resultado.comandoId,
    latenciaMs: resultado.latenciaMs,
    alGuardar: () => {
      guardado.current = resultado.comandoId;
      window.setTimeout(() => cerrar(), 1700); // lo que dura el sello
    },
    alDescartar: cerrar,
    alCambiarGuardando: (g) => (guardando.current = g),
  };
  const titulo = TITULOS[tarjeta.tipo];
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && cerrar()}
      titulo={titulo ?? "Esto llega muy pronto"}
      icono={<Sparkles aria-hidden />}
    >
      {/* La key reinicia la tarjeta con cada comando: nada de una operación anterior queda a medias en la siguiente. */}
      {titulo ? (
        <TarjetaDe key={resultado.comandoId} tarjeta={tarjeta} comunes={comunes} />
      ) : (
        <div className="grid gap-4">
          <p className="text-lg">Por ahora registro ventas, abonos, compras, mermas y gastos por voz. Las preguntas llegan en unos días.</p>
          <Boton variante="secundario" onClick={() => alCerrar("descartada")}>
            Entendido
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
