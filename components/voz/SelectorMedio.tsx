"use client";

import type { Medio } from "@/lib/voz/confirmar-venta-reglas";
import { GrupoOpciones } from "./GrupoOpciones";

type Props = {
  medio: Medio | null;
  alCambiar: (medio: Medio) => void;
  /** Lo que anuncia el lector de pantalla: «¿Con qué pagó?». */
  pregunta: string;
};

const MEDIOS: { valor: Medio; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "yape", etiqueta: "Yape" },
  { valor: "plin", etiqueta: "Plin" },
  { valor: "transferencia", etiqueta: "Transf." },
];

// Con qué se pagó, a la vista y de un toque: lo usan la venta al contado, el abono y el gasto.
export function SelectorMedio({ medio, alCambiar, pregunta }: Props) {
  return <GrupoOpciones opciones={MEDIOS} elegido={medio} alCambiar={alCambiar} pregunta={pregunta} columnas={4} />;
}
