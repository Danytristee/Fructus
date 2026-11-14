"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { abrirComandoAMano, type IntencionAMano } from "@/app/(app)/acciones-a-mano";
import type { ResultadoVoz } from "@/components/voz/VozHoy";
import { comandoTemporal, type Entrada } from "@/lib/cola-reglas";
import { tarjetaParaAnotar } from "@/lib/cola-tarjetas-reglas";
import { nombreOperacion } from "@/lib/voz/nombre-operacion-reglas";
import { useCola } from "./ColaProveedor";

const HojaVoz = dynamic(() => import("@/components/voz/HojaVoz").then((m) => m.HojaVoz), { ssr: false });

// Abrir el comando es una ida al servidor: con la señal colgada no se espera para siempre.
const TOPE_ABRIR_MS = 10_000;

/**
 * Lo que la base rechazó desde la cola, para volver a anotarlo sin empezar de cero (/formidable 2026-11-12): la misma tarjeta, ya
 * llenada, con lo que causó el rechazo por elegir. El rechazo sale de la lista recién cuando lo nuevo quedó guardado (en la base o en
 * la cola); si se descarta, el rechazo sigue ahí. «Quitar de la lista» queda como segunda opción, en texto.
 */
export function AnotarOtraVez({ entrada }: { entrada: Entrada }) {
  const cola = useCola();
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  if (!cola || entrada.contenido.clase !== "confirmacion") return null;
  const op = entrada.contenido.operacion;

  async function abrir() {
    if (abriendo) return;
    setAbriendo(true);
    // Con señal, un comando de verdad (un doble toque no guarda dos veces); sin señal o si no responde, uno del celular y va a la cola.
    let comandoId = comandoTemporal(Date.now());
    if (navigator.onLine) {
      let reloj = 0;
      const tope = new Promise<null>((r) => (reloj = window.setTimeout(() => r(null), TOPE_ABRIR_MS)));
      const r = await Promise.race([abrirComandoAMano(`registrar_${op.tipo}` as IntencionAMano).catch(() => null), tope]);
      window.clearTimeout(reloj);
      if (r?.ok) comandoId = r.comandoId;
    }
    setAbriendo(false);
    setResultado({ comandoId, tarjeta: tarjetaParaAnotar(op, entrada.error), latenciaMs: 0 });
    setAbierta(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void cola.quitar(entrada.id)}
        className="min-h-12 rounded-full px-4 font-extrabold text-texto underline underline-offset-4"
      >
        Quitar de la lista
      </button>
      <button
        type="button"
        onClick={() => void abrir()}
        disabled={abriendo}
        className="flex min-h-12 items-center gap-2 rounded-full bg-acento px-5 font-extrabold text-sobre-acento transition-transform duration-150 active:scale-[0.97]"
      >
        <RotateCcw aria-hidden className="size-5" />
        {abriendo ? "Abriendo…" : `Anotar${nombreOperacion(op.tipo).lo} otra vez`}
      </button>
      {resultado && (
        <HojaVoz
          resultado={resultado}
          abierta={abierta}
          titulo="Anotar otra vez"
          icono={<RotateCcw aria-hidden />}
          aMano
          alCerrar={(motivo) => {
            setAbierta(false);
            if (motivo === "guardada") void cola.quitar(entrada.id);
          }}
        />
      )}
    </>
  );
}
