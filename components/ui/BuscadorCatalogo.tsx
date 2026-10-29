"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { formatearSoles } from "@/lib/formato";
import { IconoFruta } from "./IconoFruta";

export type ProductoCatalogo = { id: number; nombre: string; variedad: string | null; precio: number | null; alias: string[] };

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// El catálogo con buscador: por fruta, variedad o cómo lo dicen por voz.
export function BuscadorCatalogo({ productos }: { productos: ProductoCatalogo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = sinTildes(busqueda.trim());
  const visibles = productos.filter((p) => !q || sinTildes(`${p.nombre} ${p.variedad ?? ""} ${p.alias.join(" ")}`).includes(q));
  return (
    <>
      <label className="vidrio mb-3 flex min-h-14 items-center gap-3 rounded-full px-4">
        <Search aria-hidden className="size-5 text-texto-suave" />
        <span className="sr-only">Buscar fruta</span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca una fruta o variedad"
          className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-texto-suave"
        />
      </label>
      <p className="mb-2 text-texto-suave">
        {visibles.length} de {productos.length} productos. El precio es el de referencia (proyectado): la app lo sugiere hasta que haya una venta real.
      </p>
      <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
        {visibles.map((p) => (
          <li key={p.id} className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
            <IconoFruta nombre={p.nombre} tamano={40} />
            <span className="grid min-w-0">
              <span className="truncate font-extrabold">{[p.nombre, p.variedad].filter(Boolean).join(" ")}</span>
              {p.alias.length > 0 && <span className="truncate text-[15px] text-texto-suave">por voz: {p.alias.slice(0, 3).join(", ")}</span>}
            </span>
            <span className="text-right">
              <span className="cifra block">{p.precio === null ? "—" : formatearSoles(p.precio)}</span>
              <span className="text-[15px] text-texto-suave">la caja</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
