"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";

import { abrirComandoAMano, type ResultadoComandoAMano } from "@/app/(app)/acciones-a-mano";
import { descartarComando } from "@/app/(app)/acciones-voz";
import { BarraFlotante } from "@/components/ui/BarraFlotante";
import { Boton } from "@/components/ui/Boton";
import { NO_ABRIO } from "@/lib/a-mano-reglas";

const cargarHoja = () => import("./HojaPago").then((m) => m.HojaPago);
const HojaPago = dynamic(cargarHoja, { ssr: false });

const TOPE_ABRIR_MS = 10_000;

type Props = { proveedor: { id: number; nombre: string }; deuda: number };

// «Registrar pago»: flota sobre la ficha del proveedor, donde alcanza el pulgar. Al tocarlo abre un comando «a mano»
// (como el abono): un doble toque en Confirmar, o un reintento, vuelve al mismo comando y no paga dos veces.
export function PagoAMano({ proveedor, deuda }: Props) {
  const [comandoId, setComandoId] = useState<number | null>(null);
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
    const r = await Promise.race([abrirComandoAMano("registrar_pago_proveedor").catch((): ResultadoComandoAMano => ({ ok: false, error: NO_ABRIO })), tope]);
    window.clearTimeout(reloj);
    setAbriendo(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setComandoId(r.comandoId);
    setAbierta(true);
  }

  function alCerrar(motivo: "guardada" | "descartada") {
    setAbierta(false);
    if (motivo === "descartada" && comandoId !== null) void descartarComando(comandoId, 0).catch(() => {});
  }

  return (
    <BarraFlotante>
      {error && (
        <p role="alert" className="pointer-events-auto w-full rounded-control bg-superficie px-3.5 py-2.5 font-bold text-deuda ring-2 ring-deuda">
          {error}
        </p>
      )}
      <Boton variante="flotante" onClick={() => void abrir()} cargando={abriendo} className="pointer-events-auto">
        <Banknote aria-hidden />
        Registrar pago
      </Boton>
      {comandoId !== null && <HojaPago key={comandoId} comandoId={comandoId} proveedor={proveedor} deuda={deuda} abierta={abierta} alCerrar={alCerrar} />}
    </BarraFlotante>
  );
}
