"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { TITULO_CONSULTA } from "@/lib/voz/consultas-reglas";
import { TarjetaAbono } from "./TarjetaAbono";
import { TarjetaCompra } from "./TarjetaCompra";
import { TarjetaConsulta } from "./TarjetaConsulta";
import { TarjetaGasto } from "./TarjetaGasto";
import { TarjetaMerma } from "./TarjetaMerma";
import { TarjetaTemperatura } from "./TarjetaTemperatura";
import { TarjetaVenta } from "./TarjetaVenta";
import type { ResultadoVoz } from "./VozHoy";

type Props = {
  resultado: ResultadoVoz;
  abierta: boolean;
  /** La hoja se cerró: «guardada» después del sello; «descartada» con Descartar, el velo o deslizando hacia abajo. */
  alCerrar: (motivo: "guardada" | "descartada", incierto?: boolean) => void;
  /** A mano (A8): el título y el icono de la operación, en vez de «¿Así fue…?» con las chispas del intérprete. */
  titulo?: string;
  icono?: React.ReactNode;
  aMano?: boolean;
};

const TITULOS: Partial<Record<ResultadoVoz["tarjeta"]["tipo"], string>> = {
  venta: "¿Así fue la venta?",
  abono: "¿Así fue el abono?",
  merma: "¿Así fue la merma?",
  gasto: "¿Así fue el gasto?",
  compra: "¿Así fue la compra?",
  temperatura: "¿Esto marca el termómetro?",
};

type Comunes = {
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
};

/** La tarjeta de cada operación que se registra por voz (las que tienen título en TITULOS). */
function TarjetaDe({ tarjeta, comunes, aMano }: { tarjeta: ResultadoVoz["tarjeta"]; comunes: Comunes; aMano: boolean }) {
  switch (tarjeta.tipo) {
    case "venta":
      return <TarjetaVenta tarjeta={tarjeta} {...comunes} />;
    case "abono":
      return <TarjetaAbono tarjeta={tarjeta} {...comunes} aMano={aMano} />;
    case "merma":
      return <TarjetaMerma tarjeta={tarjeta} {...comunes} aMano={aMano} />;
    case "gasto":
      return <TarjetaGasto tarjeta={tarjeta} {...comunes} />;
    case "compra":
      return <TarjetaCompra tarjeta={tarjeta} {...comunes} aMano={aMano} />;
    case "temperatura":
      return <TarjetaTemperatura tarjeta={tarjeta} {...comunes} aMano={aMano} />;
    case "consulta":
      return <TarjetaConsulta tarjeta={tarjeta} comandoId={comunes.comandoId} latenciaMs={comunes.latenciaMs} alListo={() => comunes.alDescartar(false)} />;
    default:
      return null;
  }
}

// La hoja de lo que se entendió: las tarjetas que guardan (venta, abono, compra, merma, gasto, temperatura) y las respuestas a lo que se
// pregunta (A7).
export function HojaVoz({ resultado, abierta, alCerrar, titulo: tituloPropio, icono, aMano = false }: Props) {
  const { tarjeta } = resultado;
  // El comando que ya se guardó: si la persona cierra la hoja durante el sello, no es un descarte.
  const guardado = useRef<number | null>(null);
  // Mientras guarda no se cierra: deslizar o tocar el velo no puede descartar una venta que está entrando (/chaos).
  const guardando = useRef(false);
  const cerrar = (incierto = false) => {
    if (guardando.current) return;
    // Una pregunta no se «descarta»: no había nada que guardar, así que no hay aviso ni Deshacer.
    const leida = tarjeta.tipo === "consulta";
    alCerrar(leida || guardado.current === resultado.comandoId ? "guardada" : "descartada", incierto);
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
  const titulo = tituloPropio ?? (tarjeta.tipo === "consulta" ? TITULO_CONSULTA[tarjeta.consulta] : TITULOS[tarjeta.tipo]);
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && cerrar()}
      titulo={titulo ?? "Esto llega muy pronto"}
      icono={icono ?? <Sparkles aria-hidden />}
    >
      {/* La key reinicia la tarjeta con cada comando: nada de una operación anterior queda a medias en la siguiente. */}
      {titulo ? (
        <TarjetaDe key={resultado.comandoId} tarjeta={tarjeta} comunes={comunes} aMano={aMano} />
      ) : (
        <div className="grid gap-4">
          <p className="text-lg">Esto todavía no lo sé hacer por voz. Inténtalo con otras palabras.</p>
          <Boton variante="secundario" onClick={() => alCerrar("descartada")}>
            Entendido
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
