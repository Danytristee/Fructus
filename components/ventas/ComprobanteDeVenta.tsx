"use client";

import Link from "next/link";
import { FileText, FileX, TriangleAlert } from "lucide-react";

import { emitirComprobante, reintentarComprobante } from "@/app/(app)/acciones-comprobantes";
import { Boton } from "@/components/ui/Boton";
import { BotonEnlace } from "@/components/ui/BotonEnlace";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { ayudaDeComprobante, enlaceDeWhatsApp, fraseDeComprobante, type ComprobanteVista, type OfertaDeFactura } from "@/lib/comprobantes/comprobante-reglas";

type Props = {
  ventaId: number;
  /** El comprobante que se ve: el vigente o, si no hay, el último rechazado. */
  comprobante: ComprobanteVista | null;
  /** Una nota aparte de la última emisión (por ejemplo, «No pude preguntarle al proveedor»). */
  aviso: string | null;
  /** Solo quienes registran ventas emiten y reintentan (el contador solo lee). */
  puedeEmitir: boolean;
  /** Si se ofrece factura: directo (el cliente tiene RUC), pidiendo el RUC primero, o no se ofrece. */
  facturar: OfertaDeFactura;
  /** Para escribir el mensaje de WhatsApp: a quién (si hay cliente y su celular) y cuánto fue. */
  envio: { nombre: string | null; telefono: string | null; total: number };
  alEmitir: (comprobante: ComprobanteVista, aviso: string | null) => void;
  alPedirRuc: () => void;
  /** Mientras emite, la hoja no se cierra: no puede decir «no emití» de algo que se está emitiendo. */
  alCambiarGuardando: (guardando: boolean) => void;
};

// El comprobante de una venta (A9): si ya tiene, qué número y en qué quedó, y qué hacer si no terminó; si no, los botones para emitirlo.
// Emitir es idempotente por venta en la base: tocar dos veces, o que lo toquen dos personas, deja un solo comprobante. Y si el
// proveedor no contestó, «Reintentar» reenvía EL MISMO número: nunca se toma otro. La boleta siempre se puede; la factura solo a un
// cliente con RUC (a quien no lo tiene se le pide, si quien mira puede editar clientes).
export function ComprobanteDeVenta({ ventaId, comprobante, aviso, puedeEmitir, facturar, envio, alEmitir, alPedirRuc, alCambiarGuardando }: Props) {
  const { confirmar, guardando, error, reiniciar } = useConfirmar<Extract<Awaited<ReturnType<typeof emitirComprobante>>, { ok: true }>>({
    alGuardar: () => undefined,
    alCambiarGuardando,
    boton: "Emitir",
  });

  /**
   * Muestra cómo quedó el comprobante. Un fallo que lo cambió (el proveedor lo rechazó) se muestra tal como quedó, no «en proceso». Y si
   * todavía no terminó (en proceso o enviado), el botón queda listo para reintentar: emitir no termina el trabajo.
   */
  const mostrar = (r: Awaited<ReturnType<typeof emitirComprobante>>) => {
    if (r.ok) alEmitir(r.comprobante, r.aviso ?? null);
    else if (r.comprobante) alEmitir(r.comprobante, null);
    if (ayudaDeComprobante(r.ok ? r.comprobante.estado : "") !== null) reiniciar();
  };

  const emitir = (tipo: "boleta" | "factura") =>
    void confirmar(async () => {
      const r = await emitirComprobante({ ventaId, tipo });
      mostrar(r);
      return r;
    });

  const reintentar = (c: ComprobanteVista) =>
    void confirmar(async () => {
      const r = await reintentarComprobante({ comprobanteId: c.id });
      mostrar(r);
      return r;
    });

  const rechazado = comprobante?.estado === "rechazado";
  const ayuda = comprobante && !rechazado ? ayudaDeComprobante(comprobante.estado) : null;
  // Un rechazo ya se ve en la tarjeta (con su motivo): repetirlo en una alerta roja no suma y a 360 px la mandaba debajo del borde.
  const yaSeVeEnLaTarjeta = rechazado && error?.mensaje.startsWith("El proveedor rechazó");
  const alerta = error && !yaSeVeEnLaTarjeta && (
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
  );

  // Uno que sigue vigente (en proceso, enviado o aceptado): su estado, y si no terminó, qué hacer.
  if (comprobante && !rechazado) {
    const { titulo, estado } = fraseDeComprobante(comprobante);
    return (
      <div className="grid gap-2">
        <div role="group" aria-label="Comprobante" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3">
          <FileText aria-hidden className="mt-0.5 size-6 shrink-0 text-texto-suave" />
          <p className="grid min-w-0">
            <span className="leading-tight font-extrabold">{titulo}</span>
            <span className="text-texto-suave">{estado}</span>
            {ayuda && <span className="mt-1 text-texto-suave">{ayuda.texto}</span>}
            {aviso && <span className="mt-1 text-texto-suave">{aviso}</span>}
          </p>
        </div>
        {ayuda && puedeEmitir && (
          <Boton variante="secundario" cargando={guardando} onClick={() => reintentar(comprobante)}>
            {ayuda.boton}
          </Boton>
        )}
        {/* Aceptado y con PDF: se ve y se manda por WhatsApp (se abre con el mensaje escrito; la persona lo envía). Lo ve quien lee, también el contador. */}
        {comprobante.estado === "aceptado" && comprobante.pdfUrl && (
          <div className="grid grid-cols-2 gap-2">
            <BotonEnlace href={comprobante.pdfUrl} target="_blank" className="min-w-0 px-3">
              Ver PDF
            </BotonEnlace>
            <BotonEnlace
              href={enlaceDeWhatsApp({ telefono: envio.telefono, nombre: envio.nombre, comprobante, total: envio.total, pdfUrl: comprobante.pdfUrl })}
              target="_blank"
              className="min-w-0 px-3"
            >
              Enviar por WhatsApp
            </BotonEnlace>
          </div>
        )}
        {alerta}
      </div>
    );
  }

  const nota =
    comprobante && rechazado ? (
      <div role="group" aria-label="Comprobante" aria-live="assertive" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3 ring-2 ring-borde">
        <FileX aria-hidden className="mt-0.5 size-6 shrink-0 text-deuda" />
        <p className="grid min-w-0">
          <span className="leading-tight font-extrabold">{fraseDeComprobante(comprobante).titulo}</span>
          <span className="font-bold text-deuda">rechazada</span>
          {comprobante.motivo && <span className="mt-1">{comprobante.motivo}</span>}
          <span className="mt-1 text-texto-suave">Puedes corregirlo y emitir otro: saldrá con otro número.</span>
        </p>
      </div>
    ) : null;

  if (!puedeEmitir) return nota;

  return (
    <div className="grid gap-2">
      {nota}
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
      {alerta}
    </div>
  );
}
