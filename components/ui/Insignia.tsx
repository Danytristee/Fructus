import { BadgePercent, Ban, Check, Clock, HandCoins, Handshake, PackagePlus, ReceiptText, Repeat, Snowflake, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";

const tipos = {
  pago: { clase: "bg-exito-fondo text-exito", Icono: Check },
  debe: { clase: "bg-deuda-fondo text-deuda", Icono: Clock },
  // «Sugerido» es un precio que nadie dijo: se marca en tono de aviso para que se revise (principio 2).
  sugerido: { clase: "bg-sol/12 text-sol", Icono: Sparkles },
  aviso: { clase: "text-deuda px-0", Icono: TriangleAlert },
  abono: { clase: "bg-exito-fondo text-exito", Icono: HandCoins },
  compra: { clase: "bg-acento/12 text-acento-texto", Icono: PackagePlus },
  gasto: { clase: "bg-acento/12 text-acento-texto", Icono: ReceiptText },
  merma: { clase: "bg-deuda-fondo text-deuda", Icono: TriangleAlert },
  anulada: { clase: "bg-texto/8 text-texto-suave", Icono: Ban },
  // La posición para negociar con un proveedor (lib/proveedores-reglas.ts, posicionDe).
  riesgo: { clase: "bg-deuda-fondo text-deuda", Icono: TriangleAlert },
  socio: { clase: "bg-acento/12 text-acento-texto", Icono: Handshake },
  ventaja: { clase: "bg-exito-fondo text-exito", Icono: BadgePercent },
  ocasional: { clase: "bg-texto/8 text-texto-suave", Icono: Repeat },
  enfriado: { clase: "bg-texto/8 text-texto-suave", Icono: Snowflake },
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
