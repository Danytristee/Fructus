"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, HandCoins, TriangleAlert } from "lucide-react";

import { confirmarAbono } from "@/app/(app)/acciones-operaciones";
import { buscarClientes, saldoDe } from "@/app/(app)/acciones-voz";
import { Avatar } from "@/components/ui/Avatar";
import { Monto } from "@/components/ui/Monto";
import { formatearSoles } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import {
  abonoActual,
  borradorAbono,
  faltaAbono,
  frasesFaltaAbono,
  fueCorregidoAbono,
  leerAbono,
  saldoTrasAbono,
  type BorradorAbono,
} from "@/lib/voz/confirmar-abono-reglas";
import { guionAbono, guionAbonoRespondido } from "@/lib/voz/guion-reglas";
import { faltaPorPreguntarAbono, opcionesDeAbono } from "@/lib/voz/pregunta-falta-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { DudasVoz } from "./DudasVoz";
import { EditorBusqueda } from "./EditorBusqueda";
import { EditorMonto } from "./EditorMonto";
import { FilaCliente } from "./FilaCliente";
import { FilaTarjeta } from "./FilaTarjeta";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { PieConfirmar } from "./PieConfirmar";
import { SelectorMedio } from "./SelectorMedio";
import { manosLibres } from "./manos-libres";
import { notaDeVoz } from "./NotaVoz";
import { useConfirmar } from "./useConfirmar";
import { useManosLibres } from "./useManosLibres";

type Abono = Extract<Tarjeta, { tipo: "abono" }>;

type Props = {
  tarjeta: Abono;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
  /** Registrado a mano (A8): lo que falta se pide en vez de marcarse en rojo, y el monto empieza vacío. */
  aMano?: boolean;
};

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de un abono dictado («el flaco me dio 80 a cuenta»): quién pagó, cuánto y con qué, y cómo queda su deuda.
// Si paga más de lo que debe se deja guardar, pero se dice en grande antes de Confirmar (decisión del 31-10).
export function TarjetaAbono({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando, aMano = false }: Props) {
  const [borrador, setBorrador] = useState<BorradorAbono>(() => borradorAbono(tarjeta));
  // La tarjeta que se muestra: la dictada, o la que dejó una respuesta hablada (lo que se dijo, las opciones y las dudas).
  const [vigente, setVigente] = useState(tarjeta);
  const [vista, setVista] = useState<"tarjeta" | "cliente" | "monto">("tarjeta");
  const [saldo, setSaldo] = useState<number | null>(null);
  const { confirmar: enviar, guardando, error, guardado, encolado, incierto } = useConfirmar<{ ok: true; saldo: number | null }>({ alGuardar, alCambiarGuardando });
  // Manos libres (ADR-0020): al abrirse se lee y se confirma diciendo «confirmo». Si falta quién pagó o cuánto, lo pregunta, y la
  // respuesta completa la tarjeta; también se corrige hablando («no, fueron 300»; ADR-0027). A mano no: quien escribe ya está mirando.
  const [guion] = useState(() => (manosLibres() && !aMano ? guionAbono(borradorAbono(tarjeta), tarjeta.dudas, opcionesDeAbono(tarjeta)) : null));
  const voz = useManosLibres<Abono>({
    guion,
    alConfirmar: () => confirmar("voz"),
    guardado: guardado !== null,
    alCorregir: (nueva, pregunta) => {
      const b = borradorAbono(nueva);
      setVigente(nueva);
      setBorrador(b);
      if ((b.cliente?.id ?? null) !== (borrador.cliente?.id ?? null)) setSaldo(null);
      return guionAbonoRespondido(borrador, b, nueva.dudas, opcionesDeAbono(nueva), pregunta);
    },
    actual: () => abonoActual(borrador, vigente.cliente.dicho),
    faltaActual: () => faltaPorPreguntarAbono(borrador, opcionesDeAbono(vigente)),
  });

  const clienteId = borrador.cliente?.id ?? null;
  useEffect(() => {
    if (clienteId === null) return;
    let vigente = true;
    void saldoDe(clienteId)
      .catch(() => null)
      .then((s) => vigente && setSaldo(s));
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const falta = faltaAbono(borrador);
  const { cliente, monto } = borrador;

  function confirmar(confirmadoPor: "toque" | "voz" = "toque") {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregidoAbono(tarjeta, borrador), latenciaMs, aMano, confirmadoPor };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarAbono(entrada), { tipo: "abono", entrada });
  }

  if (encolado) return <EnCola tipo="abono" />;

  if (guardado) {
    const queda = guardado.saldo;
    return (
      <Guardado titulo="Abono guardado">
        {cliente &&
          queda !== null &&
          (queda > 0 ? (
            <>
              {cliente.nombre} te debe <strong className="cifra text-deuda">{formatearSoles(queda)}</strong>
            </>
          ) : queda < 0 ? (
            `${cliente.nombre} tiene ${formatearSoles(-queda)} a favor`
          ) : (
            `${cliente.nombre} no te debe nada`
          ))}
      </Guardado>
    );
  }

  if (vista !== "tarjeta") {
    const volver = () => setVista("tarjeta");
    return (
      <div className="grid animate-pieza gap-3">
        <button type="button" onClick={volver} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
          <ChevronLeft aria-hidden />
          Volver al abono
        </button>
        {vista === "cliente" ? (
          <EditorBusqueda
            etiqueta="¿Quién te pagó?"
            inicial={cliente?.nombre ?? vigente.cliente.dicho ?? ""}
            opciones={vigente.cliente.opciones.map((o) => ({ ...o, detalle: null }))}
            buscar={buscarClientes}
            alElegir={(o) => {
              setSaldo(null);
              setBorrador((b) => ({ ...b, cliente: { id: o.id, nombre: o.nombre } }));
              volver();
            }}
            icono={(o) => <Avatar iniciales={iniciales(o.nombre)} tono={tonoDe(o.id)} />}
            sinResultados="No encuentro a nadie así. Prueba con otro nombre o apodo."
          />
        ) : (
          <EditorMonto
            etiqueta="¿Cuánto te dio?"
            inicial={monto}
            leer={leerAbono}
            alListo={(m) => {
              setBorrador((b) => ({ ...b, monto: m }));
              volver();
            }}
          />
        )}
      </div>
    );
  }

  const tras = cliente && saldo !== null && monto !== null && !falta.includes("monto") ? saldoTrasAbono(saldo, monto) : null;
  return (
    // Tocar la tarjeta es tomar el control: la voz se calla para que se pueda corregir o confirmar con el dedo.
    <div className="grid gap-2" onPointerDown={voz.fase === "callado" ? undefined : voz.tomarControl}>
      <FilaCliente
        style={pieza(0)}
        className="animate-pieza"
        cliente={cliente}
        dicho={vigente.cliente.dicho}
        falta={!aMano && falta.includes("cliente")}
        pendiente={aMano && falta.includes("cliente")}
        sinCliente={aMano ? "¿Quién te pagó?" : undefined}
        sinNombre={aMano ? "Toca para elegir" : "Toca para elegir quién es"}
        alTocar={() => setVista("cliente")}
      />
      <FilaTarjeta
        style={pieza(1)}
        className="animate-pieza"
        falta={!aMano && falta.includes("monto")}
        pendiente={aMano && falta.includes("monto")}
        onClick={() => setVista("monto")}
        icono={
          <span className="grid size-12 place-items-center rounded-full bg-exito/12 text-exito">
            <HandCoins aria-hidden />
          </span>
        }
        grande={monto === null || falta.includes("monto") ? "¿Cuánto te dio?" : <Monto valor={monto} tamano="cifra" />}
        chico={monto === null || falta.includes("monto") ? "Toca para poner el monto" : "Toca para cambiar el monto"}
      />

      <div className="mx-1 mt-1 grid animate-pieza gap-2" style={pieza(2)}>
        <p className="text-lg font-extrabold">¿Con qué te pagó?</p>
        <SelectorMedio medio={borrador.medio} alCambiar={(medio) => setBorrador((b) => ({ ...b, medio }))} pregunta="¿Con qué te pagó?" />
      </div>

      <DudasVoz dudas={vigente.dudas} />

      {cliente && tras && (
        <div className="animate-pieza" style={pieza(3)}>
          {tras.tipo === "a_favor" ? (
            <div role="note" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3 ring-2 ring-deuda">
              <TriangleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-deuda" />
              <p className="text-lg">
                <strong>Te dio más de lo que debe.</strong> A {cliente.nombre} le quedan{" "}
                <strong className="cifra text-deuda">{formatearSoles(tras.monto)}</strong> a favor. Si no fue así, toca el monto.
              </p>
            </div>
          ) : (
            <p className="mx-1 text-lg">
              {tras.tipo === "debe" ? (
                <>
                  Con este abono, {cliente.nombre} te debe <strong className="cifra text-deuda">{formatearSoles(tras.monto)}</strong>
                </>
              ) : (
                <>
                  Con este abono, {cliente.nombre} <strong className="text-exito">queda al día</strong>
                </>
              )}
            </p>
          )}
        </div>
      )}

      <PieConfirmar
          guardaSinSenal
        style={pieza(4)}
        aviso={frasesFaltaAbono(falta)}
        avisoNeutro={aMano}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar abono"
        alConfirmar={() => confirmar("toque")}
        nota={notaDeVoz(voz)}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
