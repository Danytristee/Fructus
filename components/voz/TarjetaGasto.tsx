"use client";

import { useState } from "react";
import { ChevronLeft, ReceiptText } from "lucide-react";

import { confirmarGasto } from "@/app/(app)/acciones-operaciones";
import { Monto } from "@/components/ui/Monto";
import { formatearSoles } from "@/lib/formato";
import { borradorGasto, CATEGORIAS, faltaGasto, fueCorregidoGasto, leerGasto, type BorradorGasto, type Categoria } from "@/lib/voz/confirmar-gasto-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorMonto } from "./EditorMonto";
import { FilaTarjeta } from "./FilaTarjeta";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { GrupoOpciones } from "./GrupoOpciones";
import { PieConfirmar } from "./PieConfirmar";
import { SelectorMedio } from "./SelectorMedio";
import { useConfirmar } from "./useConfirmar";

type Gasto = Extract<Tarjeta, { tipo: "gasto" }>;

type Props = {
  tarjeta: Gasto;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
};

// «Personal» se leía como «gasto mío»: es el pago a ayudantes y cargadores (/formidable 2026-10-31). La base guarda `personal`.
const NOMBRES: Record<Categoria, string> = { flete: "Flete", alquiler: "Alquiler", servicios: "Servicios", personal: "Ayudantes", otros: "Otros" };
const OPCIONES = CATEGORIAS.map((c) => ({ valor: c, etiqueta: NOMBRES[c] }));
const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de un gasto dictado («le di 50 al cargador»): cuánto, en qué y con qué se pagó. La categoría la elige el
// intérprete y se cambia de un toque.
export function TarjetaGasto({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando }: Props) {
  const [borrador, setBorrador] = useState<BorradorGasto>(() => borradorGasto(tarjeta));
  const [editando, setEditando] = useState(false);
  const { confirmar: enviar, guardando, error, guardado, encolado, incierto } = useConfirmar<{ ok: true }>({ alGuardar, alCambiarGuardando });
  const falta = faltaGasto(borrador);
  const { monto } = borrador;

  function confirmar() {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregidoGasto(tarjeta, borrador), latenciaMs };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarGasto(entrada), { tipo: "gasto", entrada });
  }

  if (encolado) return <EnCola tipo="gasto" />;

  if (guardado) {
    return <Guardado titulo="Gasto guardado">{monto !== null && `${formatearSoles(monto)} en ${NOMBRES[borrador.categoria].toLowerCase()}`}</Guardado>;
  }

  if (editando) {
    return (
      <div className="grid animate-pieza gap-3">
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto"
        >
          <ChevronLeft aria-hidden />
          Volver al gasto
        </button>
        <EditorMonto
          etiqueta="¿Cuánto gastaste?"
          inicial={monto}
          leer={leerGasto}
          alListo={(m) => {
            setBorrador((b) => ({ ...b, monto: m }));
            setEditando(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <FilaTarjeta
        style={pieza(0)}
        className="animate-pieza"
        falta={falta.length > 0}
        onClick={() => setEditando(true)}
        icono={
          <span className="grid size-12 place-items-center rounded-full bg-texto/8 text-texto">
            <ReceiptText aria-hidden />
          </span>
        }
        grande={monto === null || falta.length > 0 ? "¿Cuánto gastaste?" : <Monto valor={monto} tamano="cifra" />}
        chico={borrador.descripcion ? `dijiste «${borrador.descripcion}»` : "Toca para cambiar el monto"}
      />

      <div className="mx-1 mt-1 grid animate-pieza gap-2" style={pieza(1)}>
        <p className="text-lg font-extrabold">¿En qué fue?</p>
        <GrupoOpciones opciones={OPCIONES} elegido={borrador.categoria} alCambiar={(categoria) => setBorrador((b) => ({ ...b, categoria }))} pregunta="¿En qué fue?" columnas={3} />
      </div>

      <div className="mx-1 mt-1 grid animate-pieza gap-2" style={pieza(2)}>
        <p className="text-lg font-extrabold">¿Con qué pagaste?</p>
        <SelectorMedio medio={borrador.medio} alCambiar={(medio) => setBorrador((b) => ({ ...b, medio }))} pregunta="¿Con qué pagaste?" />
      </div>

      <PieConfirmar
          guardaSinSenal
        style={pieza(3)}
        aviso={falta.length > 0 ? "Falta escribir cuánto gastaste." : null}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar gasto"
        alConfirmar={confirmar}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
