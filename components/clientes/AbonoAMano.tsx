"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HandCoins } from "lucide-react";

import { abrirComandoAMano, type ResultadoComandoAMano } from "@/app/(app)/acciones-a-mano";
import { descartarComando } from "@/app/(app)/acciones-voz";
import type { ResultadoVoz } from "@/components/voz/VozHoy";
import { Boton } from "@/components/ui/Boton";
import { NO_ABRIO, tarjetaAbonoAMano } from "@/lib/a-mano-reglas";

// La hoja llega en diferido, como en «Hoy»: no pesa en la primera carga. Se pide por detrás apenas la pantalla queda
// lista, para que al tocar el botón suba sin esperar.
const cargarHoja = () => import("@/components/voz/HojaVoz").then((m) => m.HojaVoz);
const HojaVoz = dynamic(cargarHoja, { ssr: false });

// Abrir el comando es una ida al servidor: con la señal colgada, el botón no puede quedarse girando para siempre.
const TOPE_ABRIR_MS = 10_000;

type Persona = { id: number; nombre: string };
type Props = {
  /** El cliente, si se viene de su ficha. null: se elige en la hoja. */
  cliente: Persona | null;
  /** A quién ofrecer primero al elegir (los que más deben). */
  sugeridos?: Persona[];
};

// «Registrar abono»: la misma tarjeta que el abono por voz, pero llenada con lo que se toca. Flotante, en el tercio de
// abajo y sobre la barra, que es donde alcanza el pulgar (CLAUDE.md, regla 1).
export function AbonoAMano({ cliente, sugeridos = [] }: Props) {
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void cargarHoja();
  }, []);

  async function abrir() {
    if (abriendo) return;
    setAbriendo(true);
    setError(null);
    let reloj = 0;
    const tope = new Promise<ResultadoComandoAMano>((resolve) => {
      reloj = window.setTimeout(() => resolve({ ok: false, error: NO_ABRIO }), TOPE_ABRIR_MS);
    });
    const r = await Promise.race([abrirComandoAMano("registrar_abono").catch((): ResultadoComandoAMano => ({ ok: false, error: NO_ABRIO })), tope]);
    window.clearTimeout(reloj);
    setAbriendo(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // Cada vez es un comando nuevo: lo que se dejó a medias la vez anterior no vuelve a aparecer.
    setResultado({ comandoId: r.comandoId, tarjeta: tarjetaAbonoAMano(cliente, sugeridos), latenciaMs: 0 });
    setAbierta(true);
  }

  function alCerrar(motivo: "guardada" | "descartada") {
    setAbierta(false);
    if (motivo === "descartada" && resultado) void descartarComando(resultado.comandoId, 0).catch(() => {});
  }

  return (
    <>
      {/* El último renglón de la pantalla no puede quedar debajo del botón flotante. */}
      <div aria-hidden className="h-16" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 mx-auto grid max-w-xl justify-items-center gap-2 px-4">
        {error && (
          <p role="alert" className="pointer-events-auto justify-self-stretch rounded-control bg-superficie px-3.5 py-2.5 font-bold text-deuda ring-2 ring-deuda">
            {error}
          </p>
        )}
        <Boton variante="flotante" onClick={() => void abrir()} cargando={abriendo} className="pointer-events-auto">
          <HandCoins aria-hidden />
          Registrar abono
        </Boton>
      </div>
      {resultado && <HojaVoz resultado={resultado} abierta={abierta} alCerrar={alCerrar} titulo="Registrar abono" icono={<HandCoins aria-hidden />} aMano />}
    </>
  );
}
