import { formatearSoles } from "@/lib/formato";

const tamanos = {
  lista: "text-xl",
  cifra: "text-cifra",
  total: "text-total",
} as const;

const tonos = {
  normal: "text-texto",
  exito: "text-exito",
  deuda: "text-deuda",
} as const;

export type PropsMonto = {
  valor: number;
  tamano?: keyof typeof tamanos;
  /** El color nunca va solo: quien muestra una deuda pone también el texto «debe» o «te deben». */
  tono?: keyof typeof tonos;
  className?: string;
};

/** Las clases de un monto. Las comparte MontoVivo para que los dos se vean igual. */
export function clasesMonto({ tamano = "lista", tono = "normal", className }: Omit<PropsMonto, "valor">) {
  // Sin cn(): para él «text-cifra» (tamaño) y «text-deuda» (color) serían la misma clase y borraría el tamaño.
  return ["cifra inline-block", tamanos[tamano], tonos[tono], className].filter(Boolean).join(" ");
}

export function Monto({ valor, ...estilo }: PropsMonto) {
  return <span className={clasesMonto(estilo)}>{formatearSoles(valor)}</span>;
}
