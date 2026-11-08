"use client";

import Link from "next/link";
import { FileText, TriangleAlert } from "lucide-react";

import { emitirComprobante } from "@/app/(app)/acciones-comprobantes";
import { Boton } from "@/components/ui/Boton";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { fraseDeComprobante, type ComprobanteVista, type OfertaDeFactura } from "@/lib/comprobantes/comprobante-reglas";

type Props = {
  ventaId: number;
  /** El comprobante vigente de la venta, si ya tiene uno. */
  comprobante: ComprobanteVista | null;
  /** Lo que la emisión dejó dicho aparte («No hubo respuesta del proveedor…»). */
  aviso: string | null;
  /** Solo quienes registran ventas emiten (el contador solo lee). */
  puedeEmitir: boolean;
  /** Si se ofrece factura: directo (el cliente tiene RUC), pidiendo el RUC primero, o no se ofrece. */
  facturar: OfertaDeFactura;
  alEmitir: (comprobante: ComprobanteVista, aviso: string | null) => void;
  alPedirRuc: () => void;
  /** Mientras emite, la hoja no se cierra: no puede decir «no emití» de algo que se está emitiendo. */
  alCambiarGuardando: (guardando: boolean) => void;
};

// El comprobante de una venta (A9): si ya tiene, qué número y en qué quedó; si no, los botones para emitirlo. Emitir es idempotente
// por venta en la base: tocar dos veces, o que lo toquen dos personas, deja un solo comprobante. La boleta siempre se puede; la
// factura solo a un cliente con RUC (a quien no lo tiene se le pide, si quien mira puede editar clientes).
export function ComprobanteDeVenta({ ventaId, comprobante, aviso, puedeEmitir, facturar, alEmitir, alPedirRuc, alCambiarGuardando }: Props) {
  const { confirmar, guardando, error } = useConfirmar<Extract<Awaited<ReturnType<typeof emitirComprobante>>, { ok: true }>>({
    alGuardar: () => undefined,
    alCambiarGuardando,
    boton: "Emitir",
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

  const emitir = (tipo: "boleta" | "factura") =>
    void confirmar(async () => {
      const r = await emitirComprobante({ ventaId, tipo });
      if (r.ok) alEmitir(r.comprobante, r.aviso ?? null);
      return r;
    });

  return (
    <div className="grid gap-2">
      {/* Con factura, los dos botones van lado a lado: a 360 px cuatro botones apilados mandaban «Cerrar» debajo del borde. */}
      <div className={facturar ? "grid grid-cols-2 gap-2" : "grid"}>
        {facturar && (
          <Boton variante="secundario" className="min-w-0 px-3" cargando={guardando} onClick={() => (facturar === "emitir" ? emitir("factura") : alPedirRuc())}>
            Emitir factura
          </Boton>
        )}
        <Boton variante="secundario" className="min-w-0 px-3" cargando={guardando} onClick={() => emitir("boleta")}>
          Emitir boleta
        </Boton>
      </div>
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
