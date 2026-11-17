"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { confirmarTemperatura } from "@/app/(app)/acciones-frescura";
import { BotonPaso } from "@/components/ui/BotonPaso";
import { formatearGrados, GRADOS_MAXIMO, GRADOS_MINIMO, saltoRaro } from "@/lib/temperatura-reglas";
import { borradorTemperatura, faltaTemperatura, fueCorregidaTemperatura, moverGrados, type BorradorTemperatura } from "@/lib/voz/confirmar-temperatura-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { PieConfirmar } from "./PieConfirmar";
import { useConfirmar } from "./useConfirmar";

type Temperatura = Extract<Tarjeta, { tipo: "temperatura" }>;

type Props = {
  tarjeta: Temperatura;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
  /** Anotada a mano: la tarjeta pregunta cuánto marca, en vez de decir lo que entendió. */
  aMano?: boolean;
};

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de la temperatura dictada («hoy hizo 29 grados») o anotada a mano: una cifra grande y dos botones para moverla.
// Sin teclado (regla 6): del número de ayer al de hoy casi siempre hay uno o dos toques.
export function TarjetaTemperatura({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando, aMano = false }: Props) {
  const [borrador, setBorrador] = useState<BorradorTemperatura>(() => borradorTemperatura(tarjeta));
  const { confirmar: enviar, guardando, error, guardado, encolado, incierto } = useConfirmar<{ ok: true }>({ alGuardar, alCambiarGuardando });
  const falta = faltaTemperatura(borrador);
  const { grados } = borrador;
  const raro = falta.length === 0 && saltoRaro(grados, tarjeta.ayer);

  function confirmar() {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregidaTemperatura(tarjeta, borrador), latenciaMs, aMano };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarTemperatura(entrada), { tipo: "temperatura", entrada });
  }

  if (encolado) return <EnCola tipo="temperatura" />;
  if (guardado) return <Guardado titulo="Temperatura anotada">{`Hoy hace ${formatearGrados(grados)} en el puesto`}</Guardado>;

  return (
    <div className="grid gap-3">
      <div className="grid animate-pieza gap-2" style={pieza(0)}>
        <span id="etiqueta-grados" className="mx-1 text-lg font-extrabold">
          {aMano ? "¿Cuánto marca el termómetro?" : "En el puesto hace"}
        </span>
        {/* La columna de la cifra puede achicarse: con `1fr` a secas, un número larguísimo empujaba «+» y Confirmar fuera de la pantalla. */}
        <div role="group" aria-labelledby="etiqueta-grados" className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-2">
          <BotonPaso signo="menos" etiqueta="Un grado menos" disabled={grados <= GRADOS_MINIMO} alPasar={() => setBorrador((b) => moverGrados(b, -1))} />
          <output aria-live="polite" className="cifra truncate text-center text-[3.5rem] leading-none font-extrabold">
            {formatearGrados(grados)}
          </output>
          <BotonPaso signo="mas" etiqueta="Un grado más" disabled={grados >= GRADOS_MAXIMO} alPasar={() => setBorrador((b) => moverGrados(b, 1))} />
        </div>
      </div>

      {tarjeta.ayer !== null && (
        <p className="mx-1 flex animate-pieza gap-2 leading-snug text-texto-suave" style={pieza(1)}>
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-sol" />
          <span>
            Ayer anotaste {formatearGrados(tarjeta.ayer)}.{raro && <strong className="text-texto"> Es mucha diferencia: mira otra vez el termómetro.</strong>}
          </span>
        </p>
      )}

      <PieConfirmar
        guardaSinSenal
        style={pieza(2)}
        aviso={falta.length > 0 ? "Eso no parece una temperatura. Muévela a lo que marca el termómetro." : null}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar temperatura"
        alConfirmar={confirmar}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
