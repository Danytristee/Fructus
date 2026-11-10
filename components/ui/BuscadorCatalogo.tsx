"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { formatearSoles } from "@/lib/formato";
import { detalleProducto, tituloProducto, type PartesProducto } from "@/lib/productos-reglas";
import { IconoFruta } from "./IconoFruta";

/** Precio de venta y de compra por caja, de la lista del dueño. */
export type ProductoCatalogo = PartesProducto & { id: number; precio: number | null; costo: number | null; alias: string[] };

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// El catálogo con buscador: por fruta, variedad, marca, selección o cómo lo dicen por voz. Llega ya ordenado (lib/productos-reglas.ts).
export function BuscadorCatalogo({ productos }: { productos: ProductoCatalogo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = sinTildes(busqueda.trim());
  const visibles = productos.filter((p) => !q || sinTildes(`${tituloProducto(p)} ${detalleProducto(p)} ${p.alias.join(" ")}`).includes(q));
  return (
    <>
      <label className="vidrio mb-3 flex min-h-14 items-center gap-3 rounded-full px-4">
        <Search aria-hidden className="size-5 text-texto-suave" />
        <span className="sr-only">Buscar fruta</span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca fruta, variedad o marca"
          className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-texto-suave"
        />
      </label>
      <p className="mb-2 text-texto-suave">
        {visibles.length} de {productos.length} productos. El precio de venta es el de tu lista: la app lo sugiere hasta que le vendas a ese cliente.
      </p>
      <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
        {visibles.map((p) => (
          <li key={p.id} className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
            <IconoFruta nombre={tituloProducto(p)} tamano={40} />
            <span className="grid min-w-0 gap-0.5">
              <span className="leading-tight font-extrabold wrap-anywhere">{tituloProducto(p)}</span>
              {detalleProducto(p) && <span className="text-[15px] leading-snug text-texto-suave">{detalleProducto(p)}</span>}
              {p.alias.length > 0 && <span className="truncate text-[15px] text-texto-suave">por voz: {p.alias.slice(0, 3).join(", ")}</span>}
            </span>
            <span className="text-right">
              <span className="cifra block">{p.precio === null ? "sin precio" : formatearSoles(p.precio)}</span>
              <span className="text-[15px] whitespace-nowrap text-texto-suave">{p.costo === null ? "la caja" : `compra ${formatearSoles(p.costo)}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
