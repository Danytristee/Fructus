"use client";

import { useState } from "react";
import { ChevronLeft, Plus, Truck } from "lucide-react";

import { buscarProveedoresVoz, confirmarCompra, sugerirCosto } from "@/app/(app)/acciones-operaciones";
import { Boton } from "@/components/ui/Boton";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Monto } from "@/components/ui/Monto";
import { itemCompraVacio } from "@/lib/a-mano-reglas";
import { formatearCajas, formatearSoles } from "@/lib/formato";
import {
  borradorCompra,
  faltaCompra,
  frasesFaltaCompra,
  fueCorregidaCompra,
  leerCosto,
  totalCompra,
  type BorradorCompra,
} from "@/lib/voz/confirmar-compra-reglas";
import type { ItemBorrador } from "@/lib/voz/confirmar-venta-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { maduraEnLaCaja, NOMBRE_ESTADO } from "@/lib/vida-util-reglas";
import { ComoLlego } from "./ComoLlego";
import { DudasVoz } from "./DudasVoz";
import { EditorBusqueda } from "./EditorBusqueda";
import { EditorItem } from "./EditorItem";
import { FilaTarjeta } from "./FilaTarjeta";
import { EnCola } from "./EnCola";
import { Guardado } from "./Guardado";
import { InsigniaSugerido } from "./InsigniaSugerido";
import { PagoODebe } from "./PagoODebe";
import { PieConfirmar } from "./PieConfirmar";
import { useConfirmar } from "./useConfirmar";

type Compra = Extract<Tarjeta, { tipo: "compra" }>;
type Vista = { tipo: "tarjeta" } | { tipo: "proveedor" } | { tipo: "item"; n: number };

type Props = {
  tarjeta: Compra;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
  /** Registrada a mano (A8): empieza vacía, lo que falta se pide en vez de marcarse en rojo, y se pueden agregar más frutas. */
  aMano?: boolean;
};

const DE_COMPRA = { pregunta: "¿La pagaste o la debes?", contado: "Pagué", credito: "La debo", conQue: "¿Con qué pagaste?" };
const COSTO = { etiqueta: "Costo de la caja", leer: leerCosto, sugerir: sugerirCosto };
const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;
const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

function IconoProveedor() {
  return (
    <span className="grid size-12 place-items-center rounded-full bg-texto/8 text-texto">
      <Truck aria-hidden />
    </span>
  );
}

// La tarjeta de una compra dictada («el de Chao me trajo 50 de plátano isla a 25»): quién la trajo, qué fruta, a cuánto
// y si se pagó o se debe. Nunca asume contado: si no se dijo, se pregunta (decisión del 31-10). Si no se dijo el costo,
// se sugiere el último que se pagó y se marca.
export function TarjetaCompra({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando, aMano = false }: Props) {
  const [borrador, setBorrador] = useState<BorradorCompra>(() => borradorCompra(tarjeta));
  const [vista, setVista] = useState<Vista>({ tipo: "tarjeta" });
  const { confirmar: enviar, guardando, error, guardado, encolado, incierto } = useConfirmar<{ ok: true; compraId: number }>({ alGuardar, alCambiarGuardando });

  const total = totalCompra(borrador);
  const falta = faltaCompra(borrador);
  const { proveedor } = borrador;
  // Con qué temperatura se cuenta hoy. Una tarjeta que esperaba en la cola desde antes puede no traerla.
  const temperatura = tarjeta.temperatura ?? null;
  // Con una sola fruta, «¿Cómo llegó?» va a la vista; con varias, dentro de cada una (un toque), para no alargar la tarjeta.
  const unica = borrador.items.length === 1 ? borrador.items[0]! : null;
  const preguntarAqui = unica !== null && unica.productoId !== null && maduraEnLaCaja(unica.producto);

  function confirmar() {
    if (falta.length > 0) return;
    const entrada = { comandoId, borrador, corregido: fueCorregidaCompra(tarjeta, borrador), latenciaMs, aMano };
    // Con los datos, no solo la función: sin señal se guarda en el celular y se envía solo después (ADR-0019).
    void enviar(() => confirmarCompra(entrada), { tipo: "compra", entrada });
  }

  if (encolado) return <EnCola tipo="compra" />;

  if (guardado) {
    const cajas = borrador.items.reduce((s, it) => s + it.cantidad, 0);
    return (
      <Guardado titulo="Compra guardada">
        Entraron {formatearCajas(cajas)} al stock
        {borrador.condicion === "credito" && proveedor && total !== null && (
          <>
            . Le debes <strong className="cifra text-deuda">{formatearSoles(total)}</strong> a {proveedor.nombre}
          </>
        )}
      </Guardado>
    );
  }

  if (vista.tipo !== "tarjeta") {
    const volver = () => setVista({ tipo: "tarjeta" });
    return (
      <div className="grid animate-pieza gap-3">
        <button type="button" onClick={volver} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
          <ChevronLeft aria-hidden />
          Volver a la compra
        </button>
        {vista.tipo === "proveedor" ? (
          <EditorBusqueda
            etiqueta="¿Quién te la trajo?"
            inicial={proveedor?.nombre ?? tarjeta.proveedor.dicho ?? ""}
            opciones={tarjeta.proveedor.opciones.map((o) => ({ ...o, detalle: null }))}
            buscar={buscarProveedoresVoz}
            alElegir={(o) => {
              setBorrador((b) => ({ ...b, proveedor: { id: o.id, nombre: o.nombre } }));
              volver();
            }}
            icono={() => <IconoProveedor />}
            sinResultados="No encuentro a ese proveedor. Prueba con otro nombre o apodo."
            extra={
              borrador.condicion !== "credito" && (
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setBorrador((b) => ({ ...b, proveedor: null }));
                    volver();
                  }}
                >
                  Sin proveedor (la compré en el mercado)
                </Boton>
              )
            }
          />
        ) : (
          <EditorItem
            item={borrador.items[vista.n]!}
            opciones={tarjeta.items[vista.n]?.producto.opciones ?? []}
            monto={COSTO}
            comoLlego={{ temperatura }}
            alListo={(item: ItemBorrador) => {
              setBorrador((b) => ({ ...b, items: b.items.map((it, n) => (n === vista.n ? item : it)) }));
              volver();
            }}
          />
        )}
      </div>
    );
  }

  const dicho = tarjeta.proveedor.dicho;
  // «¿La pagaste o la debes?» ya lleva su pregunta escrita encima: el pie no la repite.
  const aviso = frasesFaltaCompra(falta.filter((f) => f !== "condicion"));
  return (
    <div className="grid gap-2">
      <FilaTarjeta
        style={pieza(0)}
        className="animate-pieza"
        falta={!aMano && falta.includes("proveedor")}
        pendiente={aMano && falta.includes("proveedor")}
        onClick={() => setVista({ tipo: "proveedor" })}
        icono={<IconoProveedor />}
        grande={proveedor?.nombre ?? (dicho ? `¿${dicho}?` : aMano ? "¿Quién te la trajo?" : "Sin proveedor")}
        chico={
          proveedor
            ? dicho && !mismoNombre(dicho, proveedor.nombre)
              ? `dijiste «${dicho}»`
              : undefined
            : dicho
              ? "Toca para elegir quién es"
              : aMano
                ? "Toca para elegir. Si fue en el mercado, déjalo así"
                : "La compraste en el mercado"
        }
      />
      {borrador.items.map((item, n) => (
        <FilaTarjeta
          key={n}
          style={pieza(n + 1)}
          className="animate-pieza"
          falta={!aMano && (item.productoId === null || item.precio === null)}
          pendiente={aMano && (item.productoId === null || item.cantidad < 1 || item.precio === null)}
          onClick={() => setVista({ tipo: "item", n })}
          icono={<IconoFruta nombre={item.producto || "?"} tamano={48} />}
          grande={
            item.productoId === null
              ? aMano
                ? "¿Qué fruta?"
                : `¿${item.producto}?`
              : item.cantidad < 1
                ? `¿Cuántas cajas de ${item.producto}?`
                : `${formatearCajas(item.cantidad)} de ${item.producto}`
          }
          chico={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="cifra">
                {item.productoId === null ? "Toca para elegir la fruta" : item.cantidad < 1 ? "Toca para poner las cajas" : item.precio === null ? "Toca para poner el costo" : `${formatearSoles(item.precio)} la caja`}
              </span>
              {item.sugerido && <InsigniaSugerido />}
              {item.estado && maduraEnLaCaja(item.producto) && <span>· {NOMBRE_ESTADO[item.estado].cajas}</span>}
            </span>
          }
        />
      ))}

      {preguntarAqui && (
        <div className="mt-1 animate-pieza" style={pieza(2)}>
          <ComoLlego fruta={unica.producto} estado={unica.estado ?? null} temperatura={temperatura} alCambiar={(estado) => setBorrador((b) => ({ ...b, items: [{ ...b.items[0]!, estado }] }))} />
        </div>
      )}

      {aMano && (
        <div className="grid animate-pieza gap-1" style={pieza(borrador.items.length + 1)}>
          <Boton
            variante="secundario"
            onClick={() => {
              setBorrador((b) => ({ ...b, items: [...b.items, itemCompraVacio()] }));
              setVista({ tipo: "item", n: borrador.items.length });
            }}
          >
            <Plus aria-hidden />
            Otra fruta
          </Boton>
          {borrador.items.length > 1 && (
            <Boton variante="texto" onClick={() => setBorrador((b) => ({ ...b, items: b.items.slice(0, -1) }))}>
              Quitar la última fruta
            </Boton>
          )}
        </div>
      )}

      <DudasVoz dudas={tarjeta.dudas} />

      <div className="mx-1 mt-1 mb-1 flex animate-pieza items-baseline justify-between gap-3" style={pieza(borrador.items.length + 1)}>
        <span className="text-lg font-bold text-texto-suave">Total</span>
        {total === null ? <span className={`text-lg font-bold ${aMano ? "text-texto-suave" : "text-deuda"}`}>Falta el costo</span> : <Monto valor={total} tamano="total" className="origin-right animate-saltar" />}
      </div>

      <div className="animate-pieza" style={pieza(borrador.items.length + 2)}>
        <PagoODebe
          condicion={borrador.condicion}
          medio={borrador.medio}
          textos={DE_COMPRA}
          alCambiar={(condicion, medio) => setBorrador((b) => ({ ...b, condicion, medio }))}
        />
      </div>

      <PieConfirmar
          guardaSinSenal
        style={pieza(borrador.items.length + 3)}
        aviso={aviso}
        avisoNeutro={aMano}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar compra"
        // Las dos opciones, aunque a 360 px ocupe dos líneas: «¿la pagaste?» solo no parecía botón ni aviso (/formidable 2026-10-31).
        etiquetaPendiente={falta.length === 1 && falta[0] === "condicion" ? "Primero: ¿pagaste o debes?" : undefined}
        alConfirmar={confirmar}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
