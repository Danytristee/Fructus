"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Truck } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Filtros } from "@/components/ui/Filtros";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Vacio } from "@/components/ui/Vacio";
import { porcentaje as pct } from "@/lib/negociacion-reglas";
import type { Posicion } from "@/lib/proveedores-reglas";

export type FilaProveedor = {
  id: number;
  nombre: string;
  apodo: string | null;
  origen: string | null;
  iniciales: string;
  tono: number;
  participacion: number;
  saldo: number;
  posicion: Posicion;
  titulo: string;
  /** Su porqué en una línea: «Andina te deja manzana a S/ 26 menos» (lib/negociacion-reglas.ts, razonCorta). */
  razon: string;
  /** Hay un proveedor que te deja alguna de sus frutas más barata. */
  masCaro: boolean;
  sinCompras: boolean;
};

type Filtro = "todos" | "negociar" | "riesgo" | "debes";

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const pasa: Record<Filtro, (p: FilaProveedor) => boolean> = {
  todos: () => true,
  negociar: (p) => p.posicion === "ventaja" || p.masCaro,
  riesgo: (p) => p.posicion === "riesgo",
  debes: (p) => p.saldo > 0,
};

// Tus proveedores, del que más pesa al que menos: cuánto de tus compras se lleva cada uno (barra y número), qué te conviene hacer con
// él (insignia) y lo que le debes. Un toque abre su ficha.
export function ListaProveedores({ proveedores, nuevo }: { proveedores: FilaProveedor[]; nuevo?: React.ReactNode }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const q = sinTildes(busqueda.trim());
  const visibles = proveedores.filter(pasa[filtro]).filter((p) => !q || sinTildes(`${p.nombre} ${p.apodo ?? ""} ${p.origen ?? ""}`).includes(q));
  const maximo = Math.max(...proveedores.map((p) => p.participacion), 0.01);

  return (
    <section aria-labelledby="lista-proveedores" className="mt-6">
      <h2 id="lista-proveedores" className="sr-only">
        Tus proveedores
      </h2>
      {/* La búsqueda arriba y los filtros debajo, también en escritorio: con cuatro filtros en la columna, una sola fila aplastaba la búsqueda. */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <label className="vidrio flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-full px-4">
            <Search aria-hidden className="size-5 text-texto-suave" />
            <span className="sr-only">Buscar proveedor</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por nombre o lugar"
              className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-texto-suave"
            />
          </label>
          {nuevo}
        </div>
        <Filtros
          etiqueta="Filtrar proveedores"
          valor={filtro}
          alCambiar={setFiltro}
          opciones={[
            { valor: "todos", etiqueta: "Todos", cuenta: proveedores.length },
            // Los filtros dicen lo mismo que las insignias: «Para negociar» no se entendía en la prueba a ciegas (/formidable 2026-11-12).
            { valor: "negociar", etiqueta: "Pide rebaja", cuenta: proveedores.filter(pasa.negociar).length },
            { valor: "riesgo", etiqueta: "Dependes de él", cuenta: proveedores.filter(pasa.riesgo).length },
            { valor: "debes", etiqueta: "Les debes", cuenta: proveedores.filter(pasa.debes).length },
          ]}
        />
      </div>
      {visibles.length === 0 ? (
        <Vacio className="mt-3" icono={<Truck />} titulo={proveedores.length === 0 ? "Todavía no tienes proveedores" : "No hay nadie así"}>
          {proveedores.length === 0 ? "Agrega al primero con el botón +." : "Prueba con otro nombre o cambia el filtro."}
        </Vacio>
      ) : (
        <ul key={filtro} className="vidrio mt-3 divide-y divide-border overflow-hidden rounded-tarjeta">
          {visibles.map((p, i) => (
            <li key={p.id} className="animate-subir px-4 py-1" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <Link
                href={`/proveedores/${p.id}`}
                className="grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-transform duration-150 active:scale-[0.99]"
              >
                <Avatar iniciales={p.iniciales} tono={p.tono} />
                <span className="grid min-w-0 gap-1">
                  <span className="leading-tight font-extrabold wrap-anywhere">{p.nombre}</span>
                  {p.origen && <span className="truncate text-[15px] text-texto-suave">{p.origen}</span>}
                  {p.sinCompras ? (
                    <span className="text-[15px] text-texto-suave">Sin compras en 90 días</span>
                  ) : (
                    <span className="flex items-center gap-2" aria-label={`${pct(p.participacion)} de tus compras`}>
                      <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-texto/8">
                        <span className="block h-full rounded-full bg-acento" style={{ width: `${(p.participacion / maximo) * 100}%` }} />
                      </span>
                      <span className="cifra shrink-0 text-right text-[15px] font-extrabold whitespace-nowrap">{pct(p.participacion)}</span>
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Insignia tipo={p.posicion}>{p.titulo}</Insignia>
                    <span className="w-full leading-snug wrap-anywhere">{p.razon}</span>
                    {p.saldo > 0 && (
                      // La palabra acompaña al color: el rojo nunca es la única señal.
                      <span className="flex items-baseline gap-1.5 text-[15px] font-extrabold text-deuda">
                        le debes <Monto valor={p.saldo} tono="deuda" />
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-6 text-texto-suave" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
