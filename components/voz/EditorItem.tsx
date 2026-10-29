"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { buscarProductos, sugerirPrecios } from "@/app/(app)/acciones-voz";
import { Boton } from "@/components/ui/Boton";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Insignia } from "@/components/ui/Insignia";
import { formatearSoles } from "@/lib/formato";
import type { ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { FilaTarjeta } from "./FilaTarjeta";

type Props = {
  item: ItemBorrador;
  /** Las 3 frutas más parecidas que trajo la voz, si no eligió una sola. */
  opciones: { id: number; nombre: string }[];
  clienteId: number | null;
  alListo: (item: ItemBorrador) => void;
};

const comoNumero = (texto: string) => {
  const n = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
  return texto.trim() === "" || !Number.isFinite(n) ? null : n;
};

// Corregir una fruta de la venta: cuál es, cuántas cajas y a cuánto. El número se escribe con el teclado de números.
export function EditorItem({ item, opciones, clienteId, alListo }: Props) {
  const [borrador, setBorrador] = useState(item);
  const [eligiendo, setEligiendo] = useState(item.productoId === null);
  const [precioTexto, setPrecioTexto] = useState(item.precio === null ? "" : String(item.precio));

  async function elegirFruta(o: { id: number; nombre: string }) {
    setEligiendo(false);
    setBorrador((b) => ({ ...b, productoId: o.id, producto: o.nombre }));
    // Otra fruta, otro precio: se sugiere el suyo (marcado) salvo que la persona ya haya dicho o escrito uno.
    if (!borrador.sugerido && borrador.precio !== null) return;
    const precios = await sugerirPrecios(clienteId, [o.id]).catch(() => null);
    const sugerido = precios?.[0] ?? null;
    setBorrador((b) => ({ ...b, precio: sugerido, sugerido: sugerido !== null }));
    setPrecioTexto(sugerido === null ? "" : String(sugerido));
  }

  if (eligiendo) {
    return (
      <EditorBusqueda
        etiqueta="¿Qué fruta fue?"
        inicial={borrador.producto}
        opciones={opciones.map((o) => ({ ...o, detalle: null }))}
        buscar={buscarProductos}
        alElegir={elegirFruta}
        icono={(o) => <IconoFruta nombre={o.nombre} tamano={40} />}
        sinResultados="No encuentro esa fruta. Prueba con otro nombre."
      />
    );
  }

  const cajas = borrador.cantidad;
  return (
    <div className="grid gap-4">
      <FilaTarjeta icono={<IconoFruta nombre={borrador.producto} tamano={48} />} grande={borrador.producto} chico="Toca para cambiar la fruta" onClick={() => setEligiendo(true)} />

      <div className="grid gap-1.5">
        <span id="etiqueta-cajas" className="font-bold">
          Cajas
        </span>
        <div role="group" aria-labelledby="etiqueta-cajas" className="grid grid-cols-[56px_1fr_56px] items-center gap-2">
          <button
            type="button"
            disabled={cajas <= 1}
            onClick={() => setBorrador((b) => ({ ...b, cantidad: Math.max(1, b.cantidad - 1) }))}
            className="grid size-14 place-items-center rounded-full bg-superficie transition-transform active:scale-95 disabled:opacity-40"
          >
            <Minus aria-hidden />
            <span className="sr-only">Una caja menos</span>
          </button>
          <output aria-live="polite" className="cifra text-center text-cifra font-extrabold">
            {cajas}
          </output>
          <button
            type="button"
            onClick={() => setBorrador((b) => ({ ...b, cantidad: b.cantidad + 1 }))}
            className="grid size-14 place-items-center rounded-full bg-superficie transition-transform active:scale-95"
          >
            <Plus aria-hidden />
            <span className="sr-only">Una caja más</span>
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="precio-caja" className="flex items-center gap-2 font-bold">
          Precio de la caja
          {borrador.sugerido && <Insignia tipo="sugerido">sugerido</Insignia>}
        </label>
        <div className="flex min-h-14 items-center gap-2 rounded-control border-2 border-borde/50 bg-superficie px-4 focus-within:border-acento">
          <span className="text-lg font-bold text-texto-suave">S/</span>
          <input
            id="precio-caja"
            inputMode="decimal"
            autoComplete="off"
            value={precioTexto}
            onChange={(e) => {
              setPrecioTexto(e.target.value);
              setBorrador((b) => ({ ...b, precio: comoNumero(e.target.value), sugerido: false }));
            }}
            className="cifra min-h-12 w-full bg-transparent text-2xl font-extrabold outline-none"
          />
        </div>
        {borrador.precio !== null && (
          <p className="text-texto-suave">
            {cajas} × {formatearSoles(borrador.precio)} = <strong className="cifra text-texto">{formatearSoles(cajas * borrador.precio)}</strong>
          </p>
        )}
      </div>

      <Boton onClick={() => alListo(borrador)} disabled={borrador.productoId === null}>
        Listo
      </Boton>
    </div>
  );
}
