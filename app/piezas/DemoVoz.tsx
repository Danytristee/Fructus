"use client";

import { useRef, useState } from "react";
import { Sparkles, Pencil, Info } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { Monto } from "@/components/ui/Monto";
import { Insignia } from "@/components/ui/Insignia";
import { Fruta } from "@/components/ui/Fruta";
import { BotonVoz, type EstadoVoz } from "@/components/voz/BotonVoz";

// Solo para /piezas: simula la voz para ver el orbe y la hoja moverse. No graba ni guarda nada.
export function DemoVoz() {
  const [estado, setEstado] = useState<EstadoVoz>("listo");
  const [texto, setTexto] = useState("Mantén para hablar");
  const [abierta, setAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const reloj = useRef<number>(0);

  function presionar() {
    setEstado("escuchando");
    navigator.vibrate?.(20);
    const inicio = Date.now();
    setTexto("Te escucho… 0:00");
    reloj.current = window.setInterval(() => {
      setTexto(`Te escucho… 0:${String(Math.floor((Date.now() - inicio) / 1000)).padStart(2, "0")}`);
    }, 250);
  }
  function soltar() {
    if (estado !== "escuchando") return;
    window.clearInterval(reloj.current);
    setEstado("entendiendo");
    setTexto("Entendiendo…");
    window.setTimeout(() => {
      setEstado("listo");
      setTexto("Mantén para hablar");
      setAbierta(true);
    }, 900);
  }
  function confirmar() {
    setGuardando(true);
    window.setTimeout(() => {
      setGuardando(false);
      navigator.vibrate?.(30);
      setAbierta(false);
    }, 650);
  }

  return (
    <>
      <BotonVoz estado={estado} texto={texto} onPointerDown={presionar} onPointerUp={soltar} onPointerCancel={soltar} />
      <Hoja abierta={abierta} alCambiar={setAbierta} titulo="¿Así fue la venta?" icono={<Sparkles className="size-[22px]" />}>
        <div className="grid gap-2">
          <button type="button" className="grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-control bg-superficie px-3.5 py-3 text-left">
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-exito-fondo font-extrabold text-exito">LP</span>
            <span className="grid">
              <span className="text-[22px] leading-tight font-extrabold">Don Lucho</span>
              <span className="text-texto-suave">Luis Paredes</span>
            </span>
            <Pencil aria-hidden className="size-[22px] text-texto-suave" />
          </button>
          <button type="button" className="grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-control bg-superficie px-3.5 py-3 text-left">
            <Fruta fruta="mango" tamano={48} />
            <span className="grid gap-0.5">
              <span className="text-[22px] leading-tight font-extrabold">10 cajas de Mango Kent</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">S/ 45.00 la caja</span>
                <Insignia tipo="sugerido">sugerido</Insignia>
              </span>
            </span>
            <Pencil aria-hidden className="size-[22px] text-texto-suave" />
          </button>
          <div className="mx-1 my-2 flex items-baseline justify-between">
            <span className="font-bold text-texto-suave">Total</span>
            <Monto valor={450} tamano="total" />
          </div>
          <p className="mx-1 mb-3 flex gap-2 text-texto-suave">
            <Info aria-hidden className="mt-0.5 size-[18px] shrink-0" /> No dijiste el precio: puse el último que le cobraste.
          </p>
          <Boton cargando={guardando} onClick={confirmar}>
            Confirmar venta
          </Boton>
          <Boton variante="texto" onClick={() => setAbierta(false)}>
            Descartar
          </Boton>
        </div>
      </Hoja>
    </>
  );
}
