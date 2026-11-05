"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Filtros } from "@/components/ui/Filtros";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Vacio } from "@/components/ui/Vacio";

export type ClienteCuaderno = {
  id: number;
  nombre: string;
  apodo: string | null;
  iniciales: string;
  tono: number;
  saldo: number;
};

type Filtro = "deben" | "al_dia" | "todos";

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// El cuaderno: quién te debe y cuánto, con buscador por nombre o apodo. Un toque en un cliente abre su ficha.
export function ListaClientes({ clientes }: { clientes: ClienteCuaderno[] }) {
  const [filtro, setFiltro] = useState<Filtro>("deben");
  const [busqueda, setBusqueda] = useState("");
  const q = sinTildes(busqueda.trim());
  const visibles = clientes
    .filter((c) => (filtro === "deben" ? c.saldo > 0 : filtro === "al_dia" ? c.saldo <= 0 : true))
    .filter((c) => !q || sinTildes(`${c.nombre} ${c.apodo ?? ""}`).includes(q));

  return (
    <section aria-labelledby="cuaderno" className="mt-6">
      <h2 id="cuaderno" className="sr-only">
        Cuaderno de clientes
      </h2>
      <label className="vidrio mb-3 flex min-h-14 items-center gap-3 rounded-full px-4">
        <Search aria-hidden className="size-5 text-texto-suave" />
        <span className="sr-only">Buscar cliente</span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca por nombre o apodo"
          className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-texto-suave"
        />
      </label>
      <Filtros
        etiqueta="Filtrar clientes"
        valor={filtro}
        alCambiar={setFiltro}
        opciones={[
          { valor: "deben", etiqueta: "Te deben", cuenta: clientes.filter((c) => c.saldo > 0).length },
          { valor: "al_dia", etiqueta: "Al día", cuenta: clientes.filter((c) => c.saldo <= 0).length },
          { valor: "todos", etiqueta: "Todos", cuenta: clientes.length },
        ]}
      />
      {visibles.length === 0 ? (
        <Vacio className="mt-3" icono={<Users />} titulo="No hay nadie así">
          Prueba con otro nombre o cambia el filtro.
        </Vacio>
      ) : (
        <ul key={filtro} className="vidrio mt-3 divide-y divide-border overflow-hidden rounded-tarjeta">
          {visibles.map((c, i) => (
            <li key={c.id} className="animate-subir px-4 py-1" style={{ animationDelay: `${i * 40}ms` }}>
              <Link
                href={`/clientes/${c.id}`}
                className="grid min-h-[72px] grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2 transition-transform duration-150 active:scale-[0.99]"
              >
                <Avatar iniciales={c.iniciales} tono={c.tono} />
                <span className="grid min-w-0">
                  <span className="leading-tight font-extrabold">{c.nombre}</span>
                  {c.apodo && <span className="truncate text-base text-texto-suave">«{c.apodo}»</span>}
                </span>
                <span className="grid justify-items-end">
                  {c.saldo > 0 ? (
                    <>
                      <Monto valor={c.saldo} tono="deuda" />
                      {/* La palabra acompaña al color: el rojo nunca es la única señal. */}
                      <span className="text-[15px] font-extrabold text-deuda">debe</span>
                    </>
                  ) : (
                    <Insignia tipo="pago">Al día</Insignia>
                  )}
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
