import { PackageX, ShoppingCart, TriangleAlert } from "lucide-react";

import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import type { EstadoProducto, ResumenInventario as Resumen } from "@/lib/inventario-reglas";

type Props = { resumen: Resumen; estados: EstadoProducto[] };

// La cabeza del dashboard: qué tan sano está el inventario (anillo), cuántas cajas hay y cuánto valen, y los tres avisos.
export function ResumenInventario({ resumen, estados }: Props) {
  const conStock = estados.filter((e) => e.stock > 0);
  const sanas = conStock.filter((e) => e.alertas.length === 0).length;
  const salud = conStock.length === 0 ? 100 : Math.round((100 * sanas) / conStock.length);
  const sobrestock = estados.filter((e) => e.alertas.some((a) => a.tipo === "sobrestock")).length;

  const tiles = [
    { cuenta: resumen.frutasPorMalograrse, etiqueta: "por malograrse", Icono: TriangleAlert, clase: "bg-deuda-fondo text-deuda" },
    { cuenta: resumen.porReponer, etiqueta: "por reponer", Icono: ShoppingCart, clase: "bg-acento/12 text-acento-texto" },
    { cuenta: sobrestock, etiqueta: "con sobrestock", Icono: PackageX, clase: "bg-exito-fondo text-exito" },
  ];

  return (
    <div className="grid gap-2.5">
      <Tarjeta protagonista className="grid animate-subir grid-cols-[auto_1fr] items-center gap-4">
        <figure className="relative grid size-24 place-items-center" aria-label={`${salud} % de tus frutas están bien`}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.2" className="text-texto/10" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              strokeWidth="3.2"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${salud} 100`}
              className={`animate-dibujar-anillo ${salud >= 70 ? "stroke-exito" : "stroke-deuda"}`}
            />
          </svg>
          <span className="cifra text-2xl">{salud}%</span>
        </figure>
        <div className="grid">
          <span className="font-bold text-texto-suave">Tienes en el puesto</span>
          <span className="cifra text-cifra">
            {resumen.cajas.toLocaleString("es-PE")} {resumen.cajas === 1 ? "caja" : "cajas"}
          </span>
          <span className="text-texto-suave">
            valen unos <MontoVivo valor={resumen.valor} className="font-extrabold text-texto" />
          </span>
          <span className="text-[15px] text-texto-suave">{sanas} de {conStock.length} frutas están bien</span>
        </div>
      </Tarjeta>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ cuenta, etiqueta, Icono, clase }, i) => (
          <Tarjeta key={etiqueta} className="grid animate-subir justify-items-center gap-1 px-2 py-3 text-center" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <span className={`grid size-10 place-items-center rounded-full ${clase}`}>
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="cifra text-2xl">{cuenta}</span>
            <span className="text-[15px] leading-tight text-texto-suave">{etiqueta}</span>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
