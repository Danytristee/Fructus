"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote } from "lucide-react";

import { registrarPagoProveedor, type ResultadoPago } from "@/app/(app)/acciones-proveedores";
import { Campo } from "@/components/ui/Campo";
import { Hoja } from "@/components/ui/Hoja";
import { Monto } from "@/components/ui/Monto";
import { Guardado } from "@/components/voz/Guardado";
import { PieConfirmar } from "@/components/voz/PieConfirmar";
import { SelectorMedio } from "@/components/voz/SelectorMedio";
import { useConfirmar } from "@/components/voz/useConfirmar";
import { formatearSoles } from "@/lib/formato";
import { despuesDelPago, leerPago } from "@/lib/proveedor-reglas";
import type { Medio } from "@/lib/voz/confirmar-venta-reglas";

type Props = {
  comandoId: number;
  proveedor: { id: number; nombre: string };
  deuda: number;
  abierta: boolean;
  alCerrar: (motivo: "guardada" | "descartada") => void;
};

type PagoGuardado = Extract<ResultadoPago, { ok: true }>;

// Anotar lo que le pagaste a un proveedor: cuánto, con qué y, si quieres, una nota. Antes de Confirmar dice en grande cuánto le
// quedarás debiendo (o que te queda a favor), para que un cero de más salte a la vista. Nunca se asume el monto: se escribe o se toca
// «Todo lo que le debes».
export function HojaPago({ comandoId, proveedor, deuda, abierta, alCerrar }: Props) {
  const guardando = useRef(false);
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(abrir) => !abrir && !guardando.current && alCerrar("descartada")}
      titulo={`Pago a ${proveedor.nombre}`}
      icono={<Banknote aria-hidden />}
    >
      <Formulario comandoId={comandoId} proveedor={proveedor} deuda={deuda} alCerrar={alCerrar} alCambiarGuardando={(g) => (guardando.current = g)} />
    </Hoja>
  );
}

function Formulario({ comandoId, proveedor, deuda, alCerrar, alCambiarGuardando }: Omit<Props, "abierta"> & { alCambiarGuardando: (g: boolean) => void }) {
  const [texto, setTexto] = useState("");
  const [medio, setMedio] = useState<Medio | null>(null);
  const [nota, setNota] = useState("");
  const [tocado, setTocado] = useState(false);
  const { confirmar, guardando, error, guardado } = useConfirmar<PagoGuardado>({ alGuardar: () => undefined, alCambiarGuardando, boton: "Confirmar pago" });

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => alCerrar("guardada"), 1700);
    return () => window.clearTimeout(t);
  }, [guardado, alCerrar]);

  const lectura = leerPago(texto);
  const despues = lectura.ok ? despuesDelPago(deuda, lectura.monto) : null;
  const aviso = !lectura.ok ? (lectura.error ?? "Escribe cuánto le pagaste.") : medio === null ? "Elige con qué le pagaste." : null;

  if (guardado) {
    return <Guardado titulo="Pago guardado">{lectura.ok ? `${formatearSoles(lectura.monto)} a ${proveedor.nombre}` : proveedor.nombre}</Guardado>;
  }

  return (
    <div className="grid gap-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-control bg-texto/5 px-3.5 py-2.5">
        <span className="text-texto-suave">Hoy le debes</span>
        {deuda > 0 ? <Monto valor={deuda} tono="deuda" /> : <span className="font-extrabold text-exito">Nada</span>}
      </p>
      <div className="grid gap-2">
        <Campo
          id="pago-monto"
          etiqueta="¿Cuánto le pagaste?"
          placeholder="500"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => setTocado(true)}
          error={tocado && !lectura.ok && lectura.error ? lectura.error : undefined}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
        />
        {deuda > 0 && (
          <button
            type="button"
            onClick={() => setTexto(deuda.toFixed(2))}
            className="flex min-h-12 items-center justify-center rounded-full bg-acento/12 px-4 font-extrabold text-acento-texto active:scale-[0.98]"
          >
            Todo lo que le debes: {formatearSoles(deuda)}
          </button>
        )}
      </div>
      {despues && (
        <p role="status" className="text-lg font-bold">
          {despues.tipo === "debe" && (
            <>
              Le quedarás debiendo <span className="cifra text-deuda">{formatearSoles(despues.monto)}</span>
            </>
          )}
          {despues.tipo === "al_dia" && <span className="text-exito">Quedas al día con él.</span>}
          {despues.tipo === "a_favor" && (
            <>
              Te quedarán <span className="cifra text-exito">{formatearSoles(despues.monto)}</span> a favor (adelanto).
            </>
          )}
        </p>
      )}
      <div className="grid gap-2">
        <p className="font-bold">¿Con qué le pagaste?</p>
        <SelectorMedio medio={medio} alCambiar={setMedio} pregunta="¿Con qué le pagaste?" />
      </div>
      <Campo id="pago-nota" etiqueta="Nota (si quieres)" placeholder="a cuenta de la factura 214" value={nota} onChange={(e) => setNota(e.target.value)} autoComplete="off" maxLength={120} />
      <PieConfirmar
        aviso={aviso}
        avisoNeutro
        error={error}
        guardando={guardando}
        listo={aviso === null}
        etiqueta="Confirmar pago"
        alConfirmar={() => {
          if (aviso !== null || !lectura.ok || medio === null) return;
          void confirmar(() => registrarPagoProveedor({ comandoId, proveedorId: proveedor.id, monto: lectura.monto, medio, nota: nota.trim() || null }));
        }}
        alDescartar={() => alCerrar("descartada")}
      />
    </div>
  );
}
