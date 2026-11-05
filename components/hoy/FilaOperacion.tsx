import { HandCoins, PackagePlus, ReceiptText, TriangleAlert, ShoppingBasket } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Fruta } from "@/components/ui/Fruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import type { Estado, Operacion } from "@/lib/operaciones-reglas";

const insignias: Record<Estado, string> = {
  pago: "Pagó",
  debe: "Lo debe",
  abono: "Abono",
  compra: "Compra",
  merma: "Merma",
  gasto: "Gasto",
};

// Sin persona detrás (compra, merma, gasto, venta al paso), un icono ocupa el lugar del avatar.
function SinPersona({ estado }: { estado: Estado }) {
  const Icono =
    estado === "compra" ? PackagePlus : estado === "merma" ? TriangleAlert : estado === "gasto" ? ReceiptText : estado === "abono" ? HandCoins : ShoppingBasket;
  return (
    <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-acento/10 text-acento-texto">
      <Icono className="size-6" />
    </span>
  );
}

// Una línea de «Lo último»: quién (con su cara o un icono y la fruta), qué pasó, cuánto y su estado.
export function FilaOperacion({ op }: { op: Operacion }) {
  return (
    <li className="grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-3">
      <span className="relative">
        {op.persona ? <Avatar iniciales={op.persona.iniciales} tono={op.persona.tono} /> : <SinPersona estado={op.estado} />}
        {op.fruta && <Fruta fruta={op.fruta} tamano={26} className="absolute -right-2 -bottom-1.5" />}
      </span>
      <span className="grid min-w-0">
        <span className="leading-tight font-extrabold">{op.titulo}</span>
        <span className="text-base leading-snug text-texto-suave">{op.detalle}</span>
      </span>
      <span className="grid justify-items-end gap-1">
        {op.monto !== null && <Monto valor={op.monto} />}
        <Insignia tipo={op.estado}>{insignias[op.estado]}</Insignia>
      </span>
    </li>
  );
}
