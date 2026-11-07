import { Ban, Check, Clock, HandCoins, PackagePlus, ReceiptText, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";

const tipos = {
  pago: { clase: "bg-exito-fondo text-exito", Icono: Check },
  debe: { clase: "bg-deuda-fondo text-deuda", Icono: Clock },
  sugerido: { clase: "bg-acento/12 text-acento-texto", Icono: Sparkles },
  aviso: { clase: "text-deuda px-0", Icono: TriangleAlert },
  abono: { clase: "bg-exito-fondo text-exito", Icono: HandCoins },
  compra: { clase: "bg-acento/12 text-acento-texto", Icono: PackagePlus },
  gasto: { clase: "bg-acento/12 text-acento-texto", Icono: ReceiptText },
  merma: { clase: "bg-deuda-fondo text-deuda", Icono: TriangleAlert },
  anulada: { clase: "bg-texto/8 text-texto-suave", Icono: Ban },
} as const;

type Props = { tipo: keyof typeof tipos; children: React.ReactNode; className?: string };

// Estado en una palabra, siempre con icono y texto: el color nunca es la única señal.
export function Insignia({ tipo, children, className }: Props) {
  const { clase, Icono } = tipos[tipo];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-[3px] pr-2.5 pl-2 text-[15px] font-extrabold whitespace-nowrap",
        clase,
        className,
      )}
    >
      <Icono aria-hidden className="size-[15px]" strokeWidth={2.4} />
      {children}
    </span>
  );
}
