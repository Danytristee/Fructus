import { BadgePercent, Ban, Check, Clock, HandCoins, Handshake, PackagePlus, PencilLine, ReceiptText, Repeat, Snowflake, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";

const tipos = {
  pago: { clase: "bg-exito-fondo text-exito", Icono: Check },
  debe: { clase: "bg-deuda-fondo text-deuda", Icono: Clock },
  // «Sugerido» es un precio que nadie dijo: se marca en tono de aviso para que se revise (principio 2).
  sugerido: { clase: "bg-sol/12 text-sol", Icono: Sparkles },
  // La fruta que no alcanza en la venta («Solo hay 6»): el tono de aviso en el fondo y el icono, el texto oscuro para el 7:1 al sol,
  // como el `Aviso` de atención (/formidable 2026-11-18).
  stock: { clase: "bg-sol/12 text-texto", Icono: TriangleAlert, icono: "text-sol" },
  // «corregido»: lo que cambió al corregir hablando («no, son ocho cajas»), lo mismo que dice la voz (/formidable 2026-11-17).
  corregido: { clase: "bg-acento/12 text-acento-texto", Icono: PencilLine },
  aviso: { clase: "text-deuda px-0", Icono: TriangleAlert },
  abono: { clase: "bg-exito-fondo text-exito", Icono: HandCoins },
  compra: { clase: "bg-acento/12 text-acento-texto", Icono: PackagePlus },
  gasto: { clase: "bg-acento/12 text-acento-texto", Icono: ReceiptText },
  merma: { clase: "bg-deuda-fondo text-deuda", Icono: TriangleAlert },
  anulada: { clase: "bg-texto/8 text-texto-suave", Icono: Ban },
  // La ficha del proveedor: una compra fiada (le debes) y un pago que le hiciste.
  credito: { clase: "bg-deuda-fondo text-deuda", Icono: Clock },
  pagaste: { clase: "bg-exito-fondo text-exito", Icono: HandCoins },
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
  // El color propio del icono, si la variante lo trae (solo «stock»): el resto lo hereda del texto.
  const colorIcono = (tipos[tipo] as { icono?: string }).icono;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-[3px] pr-2.5 pl-2 text-[15px] font-extrabold whitespace-nowrap",
        clase,
        className,
      )}
    >
      <Icono aria-hidden className={cn("size-[15px]", colorIcono)} strokeWidth={2.4} />
      {children}
    </span>
  );
}
