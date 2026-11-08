"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { cn } from "cn";

import { anularVenta } from "@/app/(app)/acciones-ventas";
import { ComprobanteDeVenta } from "./ComprobanteDeVenta";
import { PedirRuc } from "./PedirRuc";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Hoja } from "@/components/ui/Hoja";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Guardado } from "@/components/voz/Guardado";
import { PieConfirmar } from "@/components/voz/PieConfirmar";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { consecuenciasDeAnular, leerMotivo, MOTIVOS_RAPIDOS, type ClaveMotivo } from "@/lib/anular-reglas";
import { horaDeLima } from "@/lib/ficha-cliente-reglas";
import { formatearHace, formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { comprobanteVigente, ofertaDeFactura } from "@/lib/comprobantes/comprobante-reglas";
import { fraseDePago, lineaDeFruta, type DetalleVenta } from "@/lib/ventas-reglas";

type Props = {
  venta: DetalleVenta | null;
  /** Solo el dueño y el administrador anulan (la base también lo exige). */
  puedeAnular: boolean;
  /** Quienes registran ventas (dueño, administrador y ayudante) emiten su boleta o factura. */
  puedeEmitir: boolean;
  /** Quienes editan clientes (dueño y administrador) pueden pedirle el RUC al cliente para hacerle factura. */
  puedeEditarClientes: boolean;
  alCerrar: () => void;
};

// El detalle de una venta del historial: a quién, qué fruta y a cuánto, cómo se pagó y quién la registró. Quien puede, la anula
// desde aquí, con sus consecuencias a la vista y su motivo.
export function HojaVenta({ venta, puedeAnular, puedeEmitir, puedeEditarClientes, alCerrar }: Props) {
  // Mientras anula, la hoja no se cierra: deslizar o tocar el velo no puede dejar a medias lo que se está guardando.
  const guardando = useRef(false);
  return (
    <Hoja abierta={venta !== null} alCambiar={(abrir) => !abrir && !guardando.current && alCerrar()} titulo="Detalle de la venta" icono={<Receipt aria-hidden />}>
      {venta && <Cuerpo key={venta.id} venta={venta} puedeAnular={puedeAnular} puedeEmitir={puedeEmitir} puedeEditarClientes={puedeEditarClientes} alCerrar={alCerrar} alCambiarGuardando={(g) => (guardando.current = g)} />}
    </Hoja>
  );
}

function Cuerpo({ venta, puedeAnular, puedeEmitir, puedeEditarClientes, alCerrar, alCambiarGuardando }: { venta: DetalleVenta; puedeAnular: boolean; puedeEmitir: boolean; puedeEditarClientes: boolean; alCerrar: () => void; alCambiarGuardando: (g: boolean) => void }) {
  const [vista, setVista] = useState<"detalle" | "anular" | "ruc">("detalle");
  // El comprobante vive aquí: al emitirlo, la hoja ya lo muestra (y deja de ofrecer anular) sin esperar a que se refresque la lista.
  const [comprobante, setComprobante] = useState(venta.comprobante);
  const [aviso, setAviso] = useState<string | null>(null);
  // Uno rechazado ya no cuenta: se muestra su motivo y se puede emitir otro o anular la venta.
  const vigente = comprobanteVigente(comprobante ? [comprobante] : []);
  const alEmitir = (c: NonNullable<typeof comprobante>, nota: string | null) => {
    setComprobante(c);
    setAviso(nota);
    setVista("detalle");
  };
  if (vista === "ruc" && venta.cliente) {
    return <PedirRuc ventaId={venta.id} cliente={venta.cliente.nombre} volver={() => setVista("detalle")} alEmitir={alEmitir} alCambiarGuardando={alCambiarGuardando} />;
  }
  if (vista === "anular") return <Anular venta={venta} volver={() => setVista("detalle")} alCerrar={alCerrar} alCambiarGuardando={alCambiarGuardando} />;

  const fecha = new Date(venta.fecha);
  const cuando = `${formatearHace(fecha, new Date())}, ${horaDeLima(fecha)}`;
  const { anulacion } = venta;
  return (
    <div className="grid gap-3">
      {anulacion && (
        <div role="note" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3 ring-2 ring-borde">
          <Ban aria-hidden className="mt-0.5 size-6 shrink-0 text-texto-suave" />
          <p className="text-lg">
            <strong>Venta anulada</strong> {formatearHace(new Date(anulacion.cuando), new Date())}
            {anulacion.por ? ` por ${anulacion.por}` : ""}. Motivo: «{anulacion.motivo}».
          </p>
        </div>
      )}

      {venta.cliente ? (
        <Link
          href={`/clientes/${venta.cliente.id}`}
          className="grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] bg-superficie px-3.5 py-3"
        >
          <Avatar iniciales={iniciales(venta.cliente.nombre)} tono={tonoDe(venta.cliente.id)} />
          <span className="grid min-w-0">
            {/* Un nombre largo sin espacios (un correo, un apodo con guiones) se parte en vez de empujar la hoja fuera de la pantalla. */}
            <span className="text-[22px] leading-tight font-extrabold [overflow-wrap:anywhere]">{venta.cliente.nombre}</span>
            <span className="text-texto-suave">Ver su ficha</span>
          </span>
          <ChevronRight aria-hidden className="size-6 text-texto-suave" />
        </Link>
      ) : (
        <p className="rounded-[20px] bg-superficie px-3.5 py-3 text-[22px] font-extrabold">Venta al paso</p>
      )}

      <div className="mx-1 grid gap-1">
        <span className={cn(anulacion && "line-through opacity-60")}>
          <Monto valor={venta.total} tamano="total" />
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tipo={venta.condicion === "credito" ? "debe" : "pago"}>{fraseDePago(venta)}</Insignia>
          <span className="text-texto-suave capitalize">{cuando}</span>
        </div>
      </div>

      <ul aria-label="Fruta de la venta" className="divide-y divide-border overflow-hidden rounded-[20px] bg-superficie">
        {venta.items.map((i, n) => {
          const { titulo, detalle } = lineaDeFruta(i, formatearSoles);
          return (
            <li key={n} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3">
              <span className="grid min-w-0">
                <span className="leading-tight font-extrabold">{titulo}</span>
                <span className="text-texto-suave">{detalle}</span>
              </span>
              <Monto valor={i.subtotal} />
            </li>
          );
        })}
      </ul>

      {venta.registradaPor && <p className="mx-1 text-texto-suave">La registró {venta.registradaPor}.</p>}

      <ComprobanteDeVenta
        ventaId={venta.id}
        comprobante={comprobante}
        aviso={aviso}
        puedeEmitir={puedeEmitir && !anulacion}
        facturar={ofertaDeFactura(venta.cliente, puedeEditarClientes)}
        cliente={venta.cliente ? { id: venta.cliente.id, puedeEditar: puedeEditarClientes } : null}
        envio={{ nombre: venta.cliente?.nombre ?? null, telefono: venta.cliente?.telefono ?? null, total: venta.total }}
        alEmitir={alEmitir}
        alPedirRuc={() => setVista("ruc")}
        alCambiarGuardando={alCambiarGuardando}
      />

      {/* Con comprobante no se anula (la base tampoco lo deja): corresponde una nota de crédito, o esperar a que termine. */}
      {puedeAnular && !anulacion && vigente && (
        <p className="mx-1 text-texto-suave">
          {vigente.estado === "pendiente"
            ? "El comprobante está en proceso: espera a que termine para anular."
            : "Ya tiene comprobante: no se puede anular. Si te equivocaste, pídele a tu contador una nota de crédito."}
        </p>
      )}

      {puedeAnular && !anulacion && !vigente && (
        <Boton variante="secundario" className="text-deuda" onClick={() => setVista("anular")}>
          <Ban aria-hidden />
          Anular esta venta
        </Boton>
      )}

      {/* La hoja se cierra tocando afuera, pero eso no se ve: un botón a la mano, para todos los roles (el ayudante y el contador no tienen otro). */}
      <Boton variante="secundario" onClick={alCerrar}>
        Cerrar
      </Boton>
    </div>
  );
}

// Anular es lo irreversible: se dice qué va a pasar (la fruta vuelve al stock, la deuda baja) y por qué se anula, y se confirma.
function Anular({ venta, volver, alCerrar, alCambiarGuardando }: { venta: DetalleVenta; volver: () => void; alCerrar: () => void; alCambiarGuardando: (g: boolean) => void }) {
  const [clave, setClave] = useState<ClaveMotivo | null>(null);
  const [escrito, setEscrito] = useState("");
  const { confirmar, guardando, error, guardado } = useConfirmar<{ ok: true }>({ alGuardar: () => undefined, alCambiarGuardando, boton: "Anular la venta" });
  const motivo = leerMotivo(clave, escrito);
  const consecuencias = consecuenciasDeAnular(venta, formatearSoles);

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(alCerrar, 1700);
    return () => window.clearTimeout(t);
  }, [guardado, alCerrar]);

  if (guardado) return <Guardado titulo="Venta anulada">{consecuencias[0]}</Guardado>;

  return (
    <div className="grid gap-3">
      <button type="button" onClick={volver} disabled={guardando} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
        <ChevronLeft aria-hidden />
        Volver a la venta
      </button>

      <p className="mx-1 text-[22px] leading-tight font-extrabold">¿Anular esta venta de {formatearSoles(venta.total)}?</p>
      <ul aria-label="Qué pasa al anular" className="grid gap-1.5 rounded-[20px] bg-superficie px-3.5 py-3">
        {consecuencias.map((c) => (
          <li key={c} className="text-lg">
            {c}
          </li>
        ))}
      </ul>

      <div role="group" aria-label="¿Por qué la anulas?" className="grid gap-2">
        <p className="mx-1 font-bold">¿Por qué la anulas?</p>
        {MOTIVOS_RAPIDOS.map((m) => (
          <button
            key={m.clave}
            type="button"
            aria-pressed={clave === m.clave}
            onClick={() => setClave(m.clave)}
            className={cn(
              "min-h-14 rounded-full px-5 text-left text-lg font-extrabold transition-colors duration-200",
              clave === m.clave ? "bg-texto text-superficie" : "bg-superficie text-texto",
            )}
          >
            {m.texto}
          </button>
        ))}
        {clave === "otro" && (
          <Campo
            id="motivo-otro"
            etiqueta="Cuéntalo en pocas palabras"
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            error={!motivo.ok && motivo.error ? motivo.error : undefined}
            autoComplete="off"
            maxLength={200}
            autoFocus
          />
        )}
      </div>

      <PieConfirmar
        aviso={motivo.ok ? null : "Elige por qué la anulas."}
        avisoNeutro
        error={error}
        guardando={guardando}
        listo={motivo.ok}
        etiqueta="Anular la venta"
        etiquetaDescartar="No, dejarla"
        alConfirmar={() => motivo.ok && void confirmar(() => anularVenta({ ventaId: venta.id, motivo: motivo.motivo }))}
        alDescartar={volver}
      />
    </div>
  );
}
