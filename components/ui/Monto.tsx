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

type Props = {
  valor: number;
  tamano?: keyof typeof tamanos;
  /** El color nunca va solo: quien muestra una deuda pone también el texto «debe» o «te deben». */
  tono?: keyof typeof tonos;
  className?: string;
};

export function Monto({ valor, tamano = "lista", tono = "normal", className }: Props) {
  // Sin cn(): para él «text-cifra» (tamaño) y «text-deuda» (color) serían la misma clase y borraría el tamaño.
  const clases = ["cifra inline-block", tamanos[tamano], tonos[tono], className].filter(Boolean).join(" ");
  return <span className={clases}>{formatearSoles(valor)}</span>;
}
