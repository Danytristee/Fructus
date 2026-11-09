"use client";

import { useState } from "react";
import { Clock, Lightbulb, PackageX, ShoppingCart, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { Desplegable } from "@/components/ui/Desplegable";
import { Filtros } from "@/components/ui/Filtros";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Vacio } from "@/components/ui/Vacio";
import { MermaAMano } from "./MermaAMano";
import type { Alerta, EstadoProducto, TipoAlerta } from "@/lib/inventario-reglas";

type Filtro = "todas" | TipoAlerta;

const tipos: Record<TipoAlerta, { etiqueta: string; Icono: typeof Clock; clase: string }> = {
  deterioro: { etiqueta: "Por malograrse", Icono: TriangleAlert, clase: "bg-deuda-fondo text-deuda" },
  reponer: { etiqueta: "Reponer", Icono: ShoppingCart, clase: "bg-acento/12 text-acento-texto" },
  sobrestock: { etiqueta: "Te sobra", Icono: PackageX, clase: "bg-exito-fondo text-exito" },
  sin_movimiento: { etiqueta: "Sin movimiento", Icono: Clock, clase: "bg-texto/8 text-texto-suave" },
};

const dias = (n: number) => `${Math.round(n * 10) / 10} ${Math.round(n * 10) / 10 === 1 ? "día" : "días"}`;

function TarjetaAlerta({ a, nombreFruta, i }: { a: Alerta; nombreFruta: string; i: number }) {
  const { Icono, clase } = tipos[a.tipo];
  return (
    <li
      className={cn("vidrio grid animate-subir gap-3 rounded-tarjeta p-4", a.gravedad === "alta" && "animate-pulso-alerta")}
      style={{ animationDelay: `${i * 50}ms` }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
        <span className="relative">
          <IconoFruta nombre={nombreFruta} tamano={44} />
          <span className={cn("absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full ring-2 ring-superficie", clase)}>
            <Icono aria-hidden className="size-3.5" strokeWidth={2.6} />
          </span>
        </span>
        <span className="grid gap-0.5">
          <span className="leading-tight font-extrabold">{a.titulo}</span>
          <span className="text-base leading-snug text-texto-suave">{a.detalle}</span>
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap", a.gravedad === "alta" ? "bg-deuda text-superficie" : "bg-texto/8 text-texto")}>
          {a.gravedad === "alta" ? "Hoy" : "Pronto"}
        </span>
      </div>
      <p className="flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
        <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
        <span>{a.recomendacion}</span>
      </p>
    </li>
  );
}

function FilaProducto({ e, puedeRegistrar }: { e: EstadoProducto; puedeRegistrar: boolean }) {
  const frescura = Math.round((1 - e.desgaste) * 100);
  const color = e.desgaste >= 0.85 ? "bg-deuda" : e.desgaste >= 0.6 ? "bg-sol" : "bg-exito";
  return (
    <li className="px-4 py-1">
      <Desplegable
        resumen={
          <span className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <IconoFruta nombre={e.nombre} tamano={40} />
            <span className="grid min-w-0">
              <span className="truncate font-extrabold">{e.nombre}</span>
              <span className="h-2 overflow-hidden rounded-full bg-texto/10" aria-hidden>
                <span className={cn("block h-full origin-left animate-llenar rounded-full", color)} style={{ width: `${Math.max(6, frescura)}%` }} />
              </span>
            </span>
            <span className="text-right">
              <span className="cifra block text-xl">{e.stock}</span>
              <span className="text-[15px] text-texto-suave">{e.stock === 1 ? "caja" : "cajas"}</span>
            </span>
          </span>
        }
      >
        <dl className="grid grid-cols-2 gap-2 pb-2">
          {[
            ["Alcanza para", e.coberturaDias === null ? "sin ventas" : dias(e.coberturaDias)],
            ["Vendes al día", `${Math.round(e.demandaDiaria * 10) / 10} cajas`],
            ["Lote más viejo", e.edadDias === null ? "—" : dias(e.edadDias)],
            ["Dura unos", dias(e.vidaUtil)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-control bg-texto/5 px-3 py-2">
              <dt className="text-[15px] text-texto-suave">{k}</dt>
              <dd className="cifra text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        {e.alertas[0] && <p className="pb-2 text-texto-suave">{e.alertas[0].recomendacion}</p>}
        {/* Registrar lo que se malogró de esta fruta: ya trae la fruta, solo falta decir cuántas cajas. */}
        {puedeRegistrar && (
          <div className="pb-2">
            <MermaAMano producto={{ id: e.id, nombre: e.nombre }} variante="fila" />
          </div>
        )}
      </Desplegable>
    </li>
  );
}

// El tablero de Stock: alertas con su recomendación, filtrables por tipo, y la lista de frutas con su frescura.
export function TableroStock({ alertas, estados, puedeRegistrar }: { alertas: Alerta[]; estados: EstadoProducto[]; puedeRegistrar: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const cuenta = (t: TipoAlerta) => alertas.filter((a) => a.tipo === t).length;
  const visibles = filtro === "todas" ? alertas : alertas.filter((a) => a.tipo === filtro);
  const nombreDe = new Map(estados.map((e) => [e.id, e.nombre]));
  const conStock = estados.filter((e) => e.stock > 0).sort((a, b) => b.desgaste - a.desgaste);

  // En escritorio (ADR-0015): qué hacer hoy y tu stock, lado a lado.
  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <section aria-labelledby="que-hacer" className="mt-6">
        <h2 id="que-hacer" className="mb-2.5 text-xl font-extrabold">
          Qué hacer hoy
        </h2>
        <Filtros
          etiqueta="Filtrar alertas"
          valor={filtro}
          alCambiar={setFiltro}
          opciones={[
            { valor: "todas" as Filtro, etiqueta: "Todas", cuenta: alertas.length },
            ...(Object.keys(tipos) as TipoAlerta[]).filter((t) => cuenta(t) > 0).map((t) => ({ valor: t as Filtro, etiqueta: tipos[t].etiqueta, cuenta: cuenta(t) })),
          ]}
        />
        {visibles.length === 0 ? (
          <Vacio className="mt-3" icono={<Lightbulb />} titulo="Todo en orden">
            Ninguna fruta necesita que hagas algo hoy.
          </Vacio>
        ) : (
          <ul key={filtro} className="mt-3 grid gap-2.5">
            {visibles.map((a, i) => (
              <TarjetaAlerta key={`${a.productoId}-${a.tipo}`} a={a} nombreFruta={nombreDe.get(a.productoId) ?? a.producto} i={i} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tu-stock" className="mt-6">
        <h2 id="tu-stock" className="mb-1 text-xl font-extrabold">
          Tu stock
        </h2>
        <p className="mb-2.5 text-texto-suave">Primero lo que más se está gastando. Toca una fruta para ver el detalle.</p>
        <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
          {conStock.map((e) => (
            <FilaProducto key={e.id} e={e} puedeRegistrar={puedeRegistrar} />
          ))}
        </ul>
      </section>
    </div>
  );
}
