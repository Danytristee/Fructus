import { PackageX, ShoppingCart, TriangleAlert } from "lucide-react";

import { veredictoDelStock } from "@/lib/inventario-reglas";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import type { EstadoProducto, ResumenInventario as Resumen } from "@/lib/inventario-reglas";

type Props = { resumen: Resumen; estados: EstadoProducto[] };

// La cabeza del dashboard: qué tan sano está el inventario (anillo), cuántas cajas hay y cuánto valen, y los tres avisos.
export function ResumenInventario({ resumen, estados }: Props) {
  const { urgentes, total } = veredictoDelStock(estados);
  // El anillo se llena con lo mismo que dice el texto: las frutas que piden algo hoy, en rojo. Sin nada urgente, queda lleno en verde.
  const lleno = total === 0 || urgentes === 0 ? 100 : Math.round((100 * urgentes) / total);
  // Cada recuadro cuenta lo mismo que su filtro de abajo; si no todas son para hoy, lo dice («1 hoy»). Antes el recuadro decía
  // «1 por malograrse» y el filtro «2», y el ciego no supo a cuál creerle (/formidable 2026-11-10).
  const { deterioro, reponer, sobrestock } = resumen.porTipo;
  const tiles = [
    { ...deterioro, etiqueta: "por malograrse", Icono: TriangleAlert, clase: "bg-deuda-fondo text-deuda" },
    { ...reponer, etiqueta: "por reponer", Icono: ShoppingCart, clase: "bg-acento/12 text-acento-texto" },
    { ...sobrestock, etiqueta: "te sobran", Icono: PackageX, clase: "bg-exito-fondo text-exito" },
  ];

  return (
    <div className="grid gap-2.5 lg:grid-cols-12 lg:gap-4">
      <Tarjeta protagonista className="grid animate-subir grid-cols-[auto_1fr] items-center gap-4 lg:col-span-7">
        <div className="grid justify-items-center gap-1">
          <figure
            className="relative grid size-24 place-items-center"
            aria-label={total === 0 ? "No tienes cajas en el puesto" : urgentes === 0 ? `Ninguna de tus ${total} frutas es urgente hoy` : `${urgentes} de ${total} frutas urgentes hoy`}
          >
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
                strokeDasharray={`${lleno} 100`}
                className={`animate-dibujar-anillo ${urgentes === 0 ? "stroke-exito" : "stroke-deuda"}`}
              />
            </svg>
            {/* El veredicto: cuántas frutas piden algo hoy («2 de 8 frutas» / «urgentes»): las mismas que llevan la etiqueta roja «Hoy» en la
                lista de abajo. Lo que puede esperar no asusta aquí (/formidable 2026-11-09). */}
            <span className="grid text-center text-[17px] leading-tight font-extrabold tabular-nums">
              {total === 0 ? (
                <>
                  <span>sin</span>
                  <span>cajas</span>
                </>
              ) : (
                <>
                  <span>{urgentes === 0 ? total : `${urgentes} de ${total}`}</span>
                  <span>frutas</span>
                </>
              )}
            </span>
          </figure>
          {total > 0 && (
            <span className={`text-[17px] font-bold ${urgentes === 0 ? "text-exito" : "text-deuda"}`}>{urgentes === 0 ? "nada urgente" : urgentes === 1 ? "urgente" : "urgentes"}</span>
          )}
        </div>
        <div className="grid">
          <span className="font-bold text-texto-suave">Tienes en el puesto</span>
          <span className="cifra text-cifra">
            {resumen.cajas.toLocaleString("es-PE")} {resumen.cajas === 1 ? "caja" : "cajas"}
          </span>
          <span className="text-texto-suave">
            valen unos <MontoVivo valor={resumen.valor} className="font-extrabold text-texto" />
          </span>
        </div>
      </Tarjeta>
      <div className="grid grid-cols-3 gap-2 lg:col-span-5 lg:gap-4">
        {tiles.map(({ total, hoy, etiqueta, Icono, clase }, i) => (
          <Tarjeta key={etiqueta} className="grid animate-subir justify-items-center gap-1 px-2 py-3 text-center" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <span className={`grid size-10 place-items-center rounded-full ${clase}`}>
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="cifra text-2xl">{total}</span>
            <span className="text-[15px] leading-tight text-texto-suave">{etiqueta}</span>
            {hoy > 0 && hoy < total && <span className="text-[15px] leading-tight font-bold text-deuda">{hoy} hoy</span>}
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
