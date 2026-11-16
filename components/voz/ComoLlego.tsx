"use client";

import { Sparkles } from "lucide-react";

import { diaDeLima } from "@/lib/formato";
import { estimarLlegada, hastaCuando } from "@/lib/frescura-reglas";
import { formatearGrados } from "@/lib/temperatura-reglas";
import { ESTADOS_LLEGADA, NOMBRE_ESTADO, vidaDeLlegada, type EstadoLlegada } from "@/lib/vida-util-reglas";
import { GrupoOpciones } from "./GrupoOpciones";

const OPCIONES = ESTADOS_LLEGADA.map((valor) => ({ valor, etiqueta: NOMBRE_ESTADO[valor].boton }));

type Props = {
  /** El nombre de la fruta: de él sale cuántos días aguanta. */
  fruta: string;
  estado: EstadoLlegada | null;
  /** La temperatura con la que se cuenta hoy; null si no se anotó ninguna. */
  temperatura: number | null;
  alCambiar: (estado: EstadoLlegada) => void;
};

// «¿Cómo llegó?» en la compra: verde, pintón o maduro, de un toque, y al lado cuánto va a aguantar con el calor de hoy.
// Es opcional (no es dinero ni stock): si no se elige, se cuenta como pintón y se dice.
export function ComoLlego({ fruta, estado, temperatura, alCambiar }: Props) {
  const hoy = diaDeLima(new Date());
  const cuenta = estimarLlegada(hoy, vidaDeLlegada(fruta, estado), temperatura === null ? [] : [{ dia: hoy, grados: temperatura }], hoy);
  const dias = cuenta.restan + 1; // hoy también cuenta
  return (
    <div className="mx-1 grid gap-2">
      <p className="text-lg font-extrabold">¿Cómo llegó?</p>
      <GrupoOpciones opciones={OPCIONES} elegido={estado} alCambiar={alCambiar} pregunta="¿Cómo llegó?" columnas={3} />
      <p className="flex gap-2 leading-snug text-texto-suave">
        <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-sol" />
        <span>
          {!estado && "Si no eliges, cuento como pintón. "}
          {temperatura === null ? "Aguanta " : `Con ${formatearGrados(temperatura)} aguanta `}
          <strong className="text-texto">{dias === 1 ? "1 día" : `${dias} días`}</strong>, hasta {hastaCuando(cuenta.fin, hoy)}.
        </span>
      </p>
    </div>
  );
}
