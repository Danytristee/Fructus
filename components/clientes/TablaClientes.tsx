"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "cn";

import { Avatar } from "@/components/ui/Avatar";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import type { ClienteCuaderno } from "./ListaClientes";

type Orden = { columna: "nombre" | "saldo"; sube: boolean };

// El cuaderno en escritorio (ADR-0015, las tablas de la dirección B): para quien revisa, una fila por cliente con su documento y su teléfono,
// ordenable por nombre o por lo que debe. Recibe la lista ya filtrada y buscada por `ListaClientes`; una fila entera abre la ficha.
export function TablaClientes({ clientes, className }: { clientes: ClienteCuaderno[]; className?: string }) {
  const [orden, setOrden] = useState<Orden>({ columna: "saldo", sube: false });
  const filas = [...clientes].sort((a, b) => {
    const d = orden.columna === "saldo" ? a.saldo - b.saldo : a.nombre.localeCompare(b.nombre, "es");
    return orden.sube ? d : -d;
  });
  const ordenarPor = (columna: Orden["columna"]) =>
    setOrden((o) => (o.columna === columna ? { columna, sube: !o.sube } : { columna, sube: columna === "nombre" }));
  const cabecera = (columna: Orden["columna"], texto: string, alDerecho = false) => {
    const activa = orden.columna === columna;
    const Flecha = orden.sube ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={activa ? (orden.sube ? "ascending" : "descending") : "none"} className={cn("px-4 py-2", alDerecho && "text-right")}>
        <button
          type="button"
          onClick={() => ordenarPor(columna)}
          className={cn("inline-flex min-h-12 items-center gap-1 font-extrabold tracking-wide uppercase", activa ? "text-texto" : "text-texto-suave")}
        >
          {texto}
          {activa && <Flecha aria-hidden className="size-4" />}
        </button>
      </th>
    );
  };

  return (
    <div className={cn("vidrio overflow-hidden rounded-tarjeta", className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Cuaderno de clientes. Toca la cabecera de una columna para ordenar.</caption>
        <thead className="border-b border-border text-sm">
          <tr>
            {cabecera("nombre", "Cliente")}
            <th scope="col" className="px-4 py-2 font-extrabold tracking-wide text-texto-suave uppercase">
              Documento
            </th>
            <th scope="col" className="px-4 py-2 font-extrabold tracking-wide text-texto-suave uppercase">
              Teléfono
            </th>
            {cabecera("saldo", "Te debe", true)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((c) => (
            <tr key={c.id} className="relative transition-colors duration-150 hover:bg-lima-suave/60 focus-within:bg-lima-suave/60">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-3">
                  <Avatar iniciales={c.iniciales} tono={c.tono} />
                  <span className="grid min-w-0">
                    {/* El enlace cubre toda la fila (after:inset-0): se toca en cualquier parte, y el lector de pantalla oye solo el nombre. */}
                    <Link href={`/clientes/${c.id}`} className="font-extrabold wrap-anywhere after:absolute after:inset-0 focus-visible:outline-none">
                      {c.nombre}
                    </Link>
                    {c.apodo && <span className="truncate text-[15px] text-texto-suave">«{c.apodo}»</span>}
                  </span>
                </span>
              </td>
              <td className="cifra px-4 py-2.5 font-semibold text-texto-suave">{c.documento ?? ""}</td>
              <td className="cifra px-4 py-2.5 font-semibold text-texto-suave">{c.telefono ?? ""}</td>
              <td className="px-4 py-2.5 text-right">
                {c.saldo > 0 ? (
                  <span className="inline-grid justify-items-end">
                    <Monto valor={c.saldo} tono="deuda" />
                    <span className="text-[15px] font-extrabold text-deuda">debe</span>
                  </span>
                ) : (
                  <Insignia tipo="pago">Al día</Insignia>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border">
          <tr>
            <td colSpan={3} className="px-4 py-3 font-bold text-texto-suave">
              {filas.length} {filas.length === 1 ? "cliente" : "clientes"}
            </td>
            <td className="px-4 py-3 text-right">
              <Monto valor={filas.reduce((s, c) => s + Math.max(0, c.saldo), 0)} tono="deuda" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
