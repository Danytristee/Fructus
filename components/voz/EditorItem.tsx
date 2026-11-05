"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "cn";

import { buscarProductos } from "@/app/(app)/acciones-voz";
import { Boton } from "@/components/ui/Boton";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Insignia } from "@/components/ui/Insignia";
import { formatearSoles } from "@/lib/formato";
import type { ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import type { LecturaMonto } from "@/lib/voz/monto-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { FilaTarjeta } from "./FilaTarjeta";

type Props = {
  item: ItemBorrador;
  /** Las 3 frutas más parecidas que trajo la voz, si no eligió una sola. */
  opciones: { id: number; nombre: string }[];
  /**
   * El precio de la caja (venta) o su costo (compra): cómo se llama, cómo se lee y cuál se sugiere al cambiar de fruta.
   * null cuando no lleva dinero (merma).
   */
  monto: { etiqueta: string; leer: (texto: string) => LecturaMonto; sugerir: (productoId: number) => Promise<number | null> } | null;
  alListo: (item: ItemBorrador) => void;
};

// Corregir una fruta de la tarjeta: cuál es, cuántas cajas y, si lleva dinero, a cuánto. El número se escribe con el
// teclado de números.
export function EditorItem({ item, opciones, monto, alListo }: Props) {
  const [borrador, setBorrador] = useState(item);
  const [eligiendo, setEligiendo] = useState(item.productoId === null);
  const [precioTexto, setPrecioTexto] = useState(item.precio === null ? "" : String(item.precio));
  // Lo escrito que no es un precio: se dice cómo escribirlo y «Listo» espera (nunca se adivina el número).
  const lectura = monto?.leer(precioTexto);
  const errorPrecio = !lectura || lectura.ok ? null : lectura.error;

  async function elegirFruta(o: { id: number; nombre: string }) {
    setEligiendo(false);
    setBorrador((b) => ({ ...b, productoId: o.id, producto: o.nombre }));
    // Otra fruta, otro precio: se sugiere el suyo (marcado) salvo que la persona ya haya dicho o escrito uno.
    if (!monto || (!borrador.sugerido && borrador.precio !== null)) return;
    const sugerido = await monto.sugerir(o.id).catch(() => null);
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

      {monto && (
        <div className="grid gap-1.5">
          <label htmlFor="precio-caja" className="flex items-center gap-2 font-bold">
            {monto.etiqueta}
            {borrador.sugerido && <Insignia tipo="sugerido">sugerido</Insignia>}
          </label>
          <div
            className={cn(
              "flex min-h-14 items-center gap-2 rounded-control border-2 bg-superficie px-4 focus-within:border-acento",
              errorPrecio ? "border-deuda" : "border-borde/50",
            )}
          >
            <span className="text-lg font-bold text-texto-suave">S/</span>
            <input
              id="precio-caja"
              inputMode="decimal"
              autoComplete="off"
              value={precioTexto}
              aria-invalid={errorPrecio ? true : undefined}
              aria-describedby={errorPrecio ? "precio-error" : undefined}
              onChange={(e) => {
                const leido = monto.leer(e.target.value);
                setPrecioTexto(e.target.value);
                setBorrador((b) => ({ ...b, precio: leido.ok ? leido.valor : null, sugerido: false }));
              }}
              className="cifra min-h-12 w-full bg-transparent text-2xl font-extrabold outline-none"
            />
          </div>
          {errorPrecio && (
            <p id="precio-error" role="alert" className="font-bold text-deuda">
              {errorPrecio}
            </p>
          )}
          {borrador.precio !== null && !errorPrecio && (
            <p className="text-texto-suave">
              {cajas} × {formatearSoles(borrador.precio)} = <strong className="cifra text-texto">{formatearSoles(cajas * borrador.precio)}</strong>
            </p>
          )}
        </div>
      )}

      <Boton onClick={() => alListo(borrador)} disabled={borrador.productoId === null || borrador.cantidad < 1 || errorPrecio !== null}>
        Listo
      </Boton>
    </div>
  );
}
