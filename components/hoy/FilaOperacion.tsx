import { HandCoins, PackagePlus, ReceiptText, TriangleAlert, ShoppingBasket } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Fruta } from "@/components/ui/Fruta";
import { horaDeLima } from "@/lib/ficha-cliente-reglas";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import type { Estado, Operacion } from "@/lib/operaciones-reglas";

export const insignias: Record<Estado, string> = {
  pago: "Pagó",
  debe: "Lo debe",
  abono: "Abono",
  compra: "Compra",
  merma: "Merma",
  gasto: "Gasto",
  anulada: "Anulada",
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

// Una línea de «Lo último»: quién (con su cara o un icono y la fruta), qué pasó, cuánto y su estado. Con `alTocar`, toda la
// fila es un botón (el historial de ventas abre así el detalle de cada una).
// `conHora`: el historial de Ventas pone la hora delante del detalle («11:56 a. m. · 1 de mango kent»): sin ella, en la prueba a ciegas no se
// sabía cuál era la última venta (/formidable 2026-11-09).
export function FilaOperacion({ op, alTocar, conHora = false }: { op: Operacion; alTocar?: () => void; conHora?: boolean }) {
  const cuerpo = (
    <>
      <span className="relative">
        {op.persona ? <Avatar iniciales={op.persona.iniciales} tono={op.persona.tono} /> : <SinPersona estado={op.estado} />}
        {op.fruta && <Fruta fruta={op.fruta} tamano={26} className="absolute -right-2 -bottom-1.5" />}
      </span>
      <span className="grid min-w-0">
        <span className="leading-tight font-extrabold wrap-anywhere">{op.titulo}</span>
        <span className="text-base leading-snug text-texto-suave wrap-anywhere">{conHora ? `${horaDeLima(new Date(op.fecha))} · ${op.detalle}` : op.detalle}</span>
      </span>
      <span className="grid justify-items-end gap-1">
        {/* Una venta anulada ya no cuenta: el monto se ve, pero tachado. */}
        {op.monto !== null && (op.estado === "anulada" ? <span className="line-through opacity-60"><Monto valor={op.monto} /></span> : <Monto valor={op.monto} />)}
        <Insignia tipo={op.estado}>{insignias[op.estado]}</Insignia>
      </span>
    </>
  );
  const clases = "grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3.5 py-3";
  if (!alTocar) return <li className={clases}>{cuerpo}</li>;
  return (
    <li>
      <button type="button" onClick={alTocar} className={`${clases} w-full text-left transition-transform duration-150 active:scale-[0.99]`}>
        {cuerpo}
      </button>
    </li>
  );
}
