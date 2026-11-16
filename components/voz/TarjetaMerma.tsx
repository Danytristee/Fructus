"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, TriangleAlert } from "lucide-react";

import { confirmarMerma, stockDe } from "@/app/(app)/acciones-operaciones";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { formatearCajas } from "@/lib/formato";
import {
  borradorMerma,
  faltaMerma,
  frasesFaltaMerma,
  fueCorregidaMerma,
  quedanTrasMerma,
  type BorradorMerma,
} from "@/lib/voz/confirmar-merma-reglas";
import { guionMerma } from "@/lib/voz/guion-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorItem } from "./EditorItem";
import { FilaTarjeta } from "./FilaTarjeta";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { PieConfirmar } from "./PieConfirmar";
import { manosLibres } from "./manos-libres";
import { notaDeVoz } from "./NotaVoz";
import { useConfirmar } from "./useConfirmar";
import { useManosLibres } from "./useManosLibres";

type Merma = Extract<Tarjeta, { tipo: "merma" }>;

type Props = {
  tarjeta: Merma;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
  /** Registrada a mano (A8): empieza sin cajas, lo que falta se pide en vez de marcarse en rojo. */
  aMano?: boolean;
};

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

// La tarjeta de una merma dictada («se malograron 3 de mango»): qué fruta, cuántas cajas y cuántas quedan. Si el stock
// queda en negativo se deja guardar, pero se dice (decisión del 28-10: el conteo inicial llega en A8).
export function TarjetaMerma({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando, aMano = false }: Props) {
  const [borrador, setBorrador] = useState<BorradorMerma>(() => borradorMerma(tarjeta));
  const [editando, setEditando] = useState(false);
  const [stock, setStock] = useState<number | null>(null);
  const { confirmar: enviar, guardando, error, guardado, encolado, incierto } = useConfirmar<{ ok: true; stock: number | null }>({ alGuardar, alCambiarGuardando });
  // Manos libres (ADR-0020): al abrirse se lee y se confirma diciendo «confirmo». A mano no: quien escribe ya está mirando.
  const [guion] = useState(() => (manosLibres() && !aMano ? guionMerma(borradorMerma(tarjeta)) : null));
  const voz = useManosLibres({ guion, alConfirmar: () => confirmar("voz"), guardado: guardado !== null });

  const productoId = borrador.producto?.id ?? null;
  useEffect(() => {
    if (productoId === null) return;
    let vigente = true;
    void stockDe(productoId)
      .catch(() => null)
      .then((s) => vigente && setStock(s));
    return () => {
      vigente = false;
    };
  }, [productoId]);

  const falta = faltaMerma(borrador);
  const { producto, cantidad } = borrador;

  function confirmar(confirmadoPor: "toque" | "voz" = "toque") {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregidaMerma(tarjeta, borrador), latenciaMs, aMano, confirmadoPor };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarMerma(entrada), { tipo: "merma", entrada });
  }

  if (encolado) return <EnCola tipo="merma" />;

  if (guardado) {
    return (
      <Guardado titulo="Merma guardada">
        {producto && guardado.stock !== null && `Te quedan ${formatearCajas(guardado.stock)} de ${producto.nombre}`}
      </Guardado>
    );
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
          Volver a la merma
        </button>
        <EditorItem
          item={{ productoId, producto: producto?.nombre ?? tarjeta.producto.dicho ?? "", cantidad, precio: null, sugerido: false }}
          opciones={tarjeta.producto.opciones}
          monto={null}
          alListo={(item) => {
            if (item.productoId !== productoId) setStock(null);
            setBorrador((b) => ({
              ...b,
              producto: item.productoId === null ? null : { id: item.productoId, nombre: item.producto },
              cantidad: item.cantidad,
            }));
            setEditando(false);
          }}
        />
      </div>
    );
  }

  const quedan = producto && stock !== null && !falta.includes("cantidad") ? quedanTrasMerma(stock, cantidad) : null;
  return (
    // Tocar la tarjeta es tomar el control: la voz se calla para que se pueda corregir o confirmar con el dedo.
    <div className="grid gap-2" onPointerDown={voz.fase === "callado" ? undefined : voz.tomarControl}>
      <FilaTarjeta
        style={pieza(0)}
        className="animate-pieza"
        falta={!aMano && falta.length > 0}
        pendiente={aMano && falta.length > 0}
        onClick={() => setEditando(true)}
        icono={<IconoFruta nombre={producto?.nombre ?? tarjeta.producto.dicho ?? "?"} tamano={48} />}
        grande={
          producto
            ? cantidad > 0
              ? `${formatearCajas(cantidad)} de ${producto.nombre}`
              : `¿Cuántas cajas de ${producto.nombre}?`
            : aMano
              ? "¿Qué fruta se malogró?"
              : `¿${tarjeta.producto.dicho}?`
        }
        // «dijiste»: entre comillas solas no se sabía si era lo dicho o lo que eligió la app (/formidable 2026-10-31).
        chico={producto ? (cantidad === 0 ? "Toca para poner las cajas" : borrador.motivo ? `dijiste «${borrador.motivo}»` : "Se malogró") : "Toca para elegir la fruta"}
      />

      {producto && quedan !== null && stock !== null && (
        <div className="animate-pieza" style={pieza(1)}>
          {quedan < 0 ? (
            <div role="note" className="flex items-start gap-3 rounded-[20px] bg-superficie px-3.5 py-3 ring-2 ring-deuda">
              <TriangleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-deuda" />
              <p className="text-lg">
                {/* Con el stock en cero o menos, «solo tenías -91 cajas» no se entiende (captura a 412 px). */}
                <strong>{stock > 0 ? `Según la app solo tenías ${formatearCajas(stock)}.` : `Según la app no te quedaba ${producto.nombre}.`}</strong> Se
                guarda igual y el stock queda en <strong className="cifra text-deuda">{formatearCajas(quedan)}</strong>: revísalo cuando puedas.
              </p>
            </div>
          ) : (
            <p className="mx-1 text-lg">
              Con esta merma te quedan <strong className="cifra">{formatearCajas(quedan)}</strong> de {producto.nombre}
            </p>
          )}
        </div>
      )}

      <PieConfirmar
          guardaSinSenal
        style={pieza(2)}
        aviso={frasesFaltaMerma(falta)}
        avisoNeutro={aMano}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar merma"
        alConfirmar={() => confirmar("toque")}
        nota={notaDeVoz(voz)}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
