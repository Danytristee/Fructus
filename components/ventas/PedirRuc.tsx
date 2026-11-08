"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { emitirComprobante } from "@/app/(app)/acciones-comprobantes";
import { Campo } from "@/components/ui/Campo";
import { PieConfirmar } from "@/components/voz/PieConfirmar";
import { useConfirmar } from "@/components/voz/useConfirmar";
import type { ComprobanteVista } from "@/lib/comprobantes/comprobante-reglas";
import { leerDocumento } from "@/lib/cliente-reglas";

type Props = {
  ventaId: number;
  cliente: string;
  volver: () => void;
  alEmitir: (comprobante: ComprobanteVista, aviso: string | null) => void;
  alCambiarGuardando: (guardando: boolean) => void;
};

// Para hacerle factura a un cliente que todavía no tiene documento hace falta su RUC. Se pide aquí, dentro de la misma hoja, y al
// confirmar se guarda en su ficha y se emite: no hay que ir a otra pantalla y volver. Es una vista de la hoja (como «Anular»).
export function PedirRuc({ ventaId, cliente, volver, alEmitir, alCambiarGuardando }: Props) {
  const [texto, setTexto] = useState("");
  const lectura = leerDocumento("RUC", texto);
  const { confirmar, guardando, error } = useConfirmar<Extract<Awaited<ReturnType<typeof emitirComprobante>>, { ok: true }>>({
    alGuardar: () => undefined,
    alCambiarGuardando,
    boton: "Guardar RUC y emitir factura",
  });

  return (
    <div className="grid gap-3">
      <button type="button" onClick={volver} disabled={guardando} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
        <ChevronLeft aria-hidden />
        Volver a la venta
      </button>

      <h3 className="mx-1 text-[22px] leading-tight font-extrabold">¿Cuál es el RUC de {cliente}?</h3>
      <p className="mx-1 text-lg">Para hacerle factura falta su RUC. Queda guardado en su ficha.</p>

      <Campo
        id="ruc-factura"
        etiqueta="RUC"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        error={texto.trim() !== "" && !lectura.ok ? lectura.error : undefined}
        inputMode="numeric"
        autoComplete="off"
        maxLength={16}
        autoFocus
      />

      <PieConfirmar
        aviso={lectura.ok ? null : "Escribe el RUC completo para emitir."}
        avisoNeutro
        error={error}
        guardando={guardando}
        listo={lectura.ok}
        etiqueta="Guardar RUC y emitir factura"
        etiquetaDescartar="Ahora no"
        alConfirmar={() =>
          lectura.ok &&
          void confirmar(async () => {
            const r = await emitirComprobante({ ventaId, tipo: "factura", ruc: lectura.numero ?? undefined });
            if (r.ok) alEmitir(r.comprobante, r.aviso ?? null);
            return r;
          })
        }
        alDescartar={volver}
      />
    </div>
  );
}
