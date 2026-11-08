"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, TriangleAlert } from "lucide-react";

import { emitirComprobante } from "@/app/(app)/acciones-comprobantes";
import { Boton } from "@/components/ui/Boton";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { fraseDeComprobante, type ComprobanteVista } from "@/lib/comprobantes/comprobante-reglas";

type Props = {
  ventaId: number;
  /** El comprobante vigente de la venta, si ya tiene uno. */
  comprobante: ComprobanteVista | null;
  /** Solo quienes registran ventas emiten (el contador solo lee). */
  puedeEmitir: boolean;
  alEmitir: (comprobante: ComprobanteVista) => void;
  /** Mientras emite, la hoja no se cierra: no puede decir «no emití» de algo que se está emitiendo. */
  alCambiarGuardando: (guardando: boolean) => void;
};

// El comprobante de una venta (A9): si ya tiene, qué número y en qué quedó; si no, el botón para emitirlo. Emitir es idempotente
// por venta en la base: tocar dos veces, o que lo toquen dos personas, deja un solo comprobante.
export function ComprobanteDeVenta({ ventaId, comprobante, puedeEmitir, alEmitir, alCambiarGuardando }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, guardando, error } = useConfirmar<Extract<Awaited<ReturnType<typeof emitirComprobante>>, { ok: true }>>({
    alGuardar: () => undefined,
    alCambiarGuardando,
    boton: "Emitir boleta",
  });

  if (comprobante) {
    const { titulo, estado } = fraseDeComprobante(comprobante);
    return (
      <div role="group" aria-label="Comprobante" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3">
        <FileText aria-hidden className="mt-0.5 size-6 shrink-0 text-texto-suave" />
        <p className="grid min-w-0">
          <span className="leading-tight font-extrabold">{titulo}</span>
          <span className="text-texto-suave">{estado}</span>
          {aviso && <span className="mt-1 text-texto-suave">{aviso}</span>}
        </p>
      </div>
    );
  }
  if (!puedeEmitir) return null;

  return (
    <div className="grid gap-2">
      <Boton
        variante="secundario"
        cargando={guardando}
        onClick={() =>
          void confirmar(async () => {
            const r = await emitirComprobante({ ventaId, tipo: "boleta" });
            if (r.ok) {
              setAviso(r.aviso ?? null);
              alEmitir(r.comprobante);
            }
            return r;
          })
        }
      >
        <FileText aria-hidden />
        Emitir boleta
      </Boton>
      {error && (
        <p role="alert" className="mx-1 flex items-start gap-2 font-bold text-deuda">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            {error.mensaje}
            {error.sinSesion && (
              <>
                {" "}
                <Link href="/login" className="underline">
                  Entrar otra vez
                </Link>
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
