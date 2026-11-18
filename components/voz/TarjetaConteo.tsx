"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { confirmarConteo, type ResultadoConteo } from "@/app/(app)/acciones-conteo";
import { stockDe } from "@/app/(app)/acciones-operaciones";
import { buscarProductos } from "@/app/(app)/acciones-voz";
import { BotonPaso } from "@/components/ui/BotonPaso";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { formatearCajas } from "@/lib/formato";
import {
  borradorConteo,
  causasPara,
  causaVale,
  diferenciaConteo,
  efectoDeCausa,
  faltaConteo,
  frasesFaltaConteo,
  fueCorregidoConteo,
  inicioContador,
  invitacionAContar,
  segunLaApp,
  selloConteo,
  veredictoConteo,
  type BorradorConteo,
  type CausaConteo,
} from "@/lib/voz/confirmar-conteo-reglas";
import { guionConteo } from "@/lib/voz/guion-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { FilaTarjeta } from "./FilaTarjeta";
import { GrupoOpciones } from "./GrupoOpciones";
import { Guardado } from "./Guardado";
import { manosLibres } from "./manos-libres";
import { notaDeVoz } from "./NotaVoz";
import { PieConfirmar } from "./PieConfirmar";
import { useConfirmar } from "./useConfirmar";
import { useManosLibres } from "./useManosLibres";

type Conteo = Extract<Tarjeta, { tipo: "conteo" }>;
type Guardado_ = Extract<ResultadoConteo, { ok: true }>;

type Props = {
  tarjeta: Conteo;
  comandoId: number;
  latenciaMs: number;
  alGuardar: () => void;
  alDescartar: (incierto: boolean) => void;
  alCambiarGuardando: (guardando: boolean) => void;
  aMano?: boolean;
};

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });
/** «Todavía leyendo» y «no se pudo leer» son distintos: el primero espera, el segundo pide señal. */
type Stock = { estado: "leyendo" } | { estado: "listo"; cajas: number } | { estado: "sin_senal" };

// Conteo físico (ADR-0028): qué fruta, cuántas cajas hay de verdad, cómo se compara con la app y, si no cuadra, por qué. El contador
// arranca en lo que dice la app: si cuadra, no se toca nada. Necesita señal: sin saber qué dice la app no hay con qué comparar.
export function TarjetaConteo({ tarjeta, comandoId, latenciaMs, alGuardar, alDescartar, alCambiarGuardando, aMano = false }: Props) {
  const [borrador, setBorrador] = useState<BorradorConteo>(() => borradorConteo(tarjeta));
  const [eligiendo, setEligiendo] = useState(false);
  // A mano el contador arranca en lo que dice la app: hasta tocarlo no se dice «Cuadra», porque todavía no se contó nada
  // (/formidable 2026-11-18). Lo dictado sí se contó: su veredicto va desde el primer cuadro.
  const [sinTocar, setSinTocar] = useState(tarjeta.contado === null);
  const [stock, setStock] = useState<Stock>(() => (typeof tarjeta.stock === "number" ? { estado: "listo", cajas: tarjeta.stock } : { estado: "leyendo" }));
  const { confirmar: enviar, guardando, error, guardado, incierto } = useConfirmar<Guardado_>({ alGuardar, alCambiarGuardando, boton: "Confirmar conteo" });
  // Manos libres (ADR-0020): lo dictado se lee con lo que decía la app al dictar (lo trae el servidor) y se confirma diciendo
  // «confirmo». Si no cuadra y no se dijo por qué, solo se avisa: la causa se elige en la tarjeta. A mano no se lee.
  const [guion] = useState(() => (manosLibres() && !aMano ? guionConteo(borradorConteo(tarjeta), typeof tarjeta.stock === "number" ? tarjeta.stock : null, tarjeta.dudas) : null));
  const voz = useManosLibres({ guion, alConfirmar: () => confirmar("voz"), guardado: guardado !== null });

  const productoId = borrador.producto?.id ?? null;
  // Se lee al abrir, al cambiar de fruta y si la base dijo que el stock cambió mientras se contaba (el error lo dice).
  useEffect(() => {
    if (productoId === null) return;
    let vigente = true;
    void stockDe(productoId)
      .catch(() => null)
      .then((s) => {
        if (!vigente) return;
        setStock((previo) => {
          // Si la app ahora dice otro número (entró una venta o una compra mientras se contaba), la causa elegida era para otra
          // diferencia: se vuelve a preguntar, con la nueva a la vista.
          if (s !== null && previo.estado === "listo" && previo.cajas !== s) setBorrador((b) => ({ ...b, causa: null }));
          return s === null ? { estado: "sin_senal" } : { estado: "listo", cajas: s };
        });
        // A mano el contador arranca en lo que dice la app; lo dictado se respeta.
        if (s !== null) setBorrador((b) => (b.contado === null ? { ...b, contado: inicioContador(s) } : b));
      });
    return () => {
      vigente = false;
    };
  }, [productoId, error?.mensaje]);

  const cajasApp = stock.estado === "listo" ? stock.cajas : null;
  const falta = faltaConteo(borrador, cajasApp);
  const dif = cajasApp !== null && borrador.contado !== null ? diferenciaConteo(borrador.contado, cajasApp) : null;

  function contar(contado: number) {
    setSinTocar(false);
    // Si la diferencia cambia de signo, la causa de antes ya no la explica: se vuelve a preguntar.
    setBorrador((b) => ({ ...b, contado, causa: cajasApp !== null && causaVale(b.causa, diferenciaConteo(contado, cajasApp)) ? b.causa : null }));
  }

  function confirmar(confirmadoPor: "toque" | "voz" = "toque") {
    if (falta.length > 0 || cajasApp === null) return;
    const entrada = { comandoId, borrador, segunApp: cajasApp, corregido: !aMano && fueCorregidoConteo(tarjeta, borrador), latenciaMs, aMano, confirmadoPor };
    // Sin datos para la cola: sin señal se dice que hace falta (no se puede comparar con la app).
    void enviar(() => confirmarConteo(entrada));
  }

  if (guardado) {
    const nombre = borrador.producto?.nombre ?? "";
    return (
      <Guardado titulo="Conteo guardado">
        {selloConteo(guardado.diferencia, borrador.causa, guardado.stock, nombre)}
      </Guardado>
    );
  }

  if (eligiendo || !borrador.producto) {
    return (
      <div className="grid animate-pieza gap-3">
        {borrador.producto && (
          <button type="button" onClick={() => setEligiendo(false)} className="-ml-2 flex min-h-12 items-center gap-1 justify-self-start px-2 font-extrabold text-acento-texto">
            <ChevronLeft aria-hidden />
            Volver al conteo
          </button>
        )}
        <EditorBusqueda
          etiqueta="¿Qué fruta contaste?"
          inicial={borrador.producto?.nombre ?? tarjeta.producto.dicho ?? ""}
          opciones={tarjeta.producto.opciones.map((o) => ({ ...o, detalle: null }))}
          buscar={buscarProductos}
          alElegir={(o) => {
            setEligiendo(false);
            setStock({ estado: "leyendo" });
            setSinTocar(true);
            setBorrador({ producto: { id: o.id, nombre: o.nombre }, contado: null, causa: null });
          }}
          icono={(o) => <IconoFruta nombre={o.nombre} tamano={40} />}
          sinResultados="No encuentro esa fruta. Prueba con otro nombre."
        />
      </div>
    );
  }

  const { producto, contado } = borrador;
  const veredicto = cajasApp !== null && contado !== null ? veredictoConteo(contado, cajasApp) : null;
  const causas = dif === null ? [] : causasPara(dif);
  return (
    // Tocar la tarjeta es tomar el control: la voz se calla para corregir o confirmar con el dedo. Deslizarla para leer, no.
    <div className="grid gap-3" {...voz.manos}>
      <FilaTarjeta
        style={pieza(0)}
        className="animate-pieza"
        onClick={() => setEligiendo(true)}
        icono={<IconoFruta nombre={producto.nombre} tamano={40} />}
        grande={producto.nombre}
        chico="Toca para cambiar la fruta"
      />

      <div className="grid animate-pieza gap-1.5" style={pieza(1)}>
        <span id="etiqueta-contadas" className="mx-1 font-bold">
          ¿Cuántas cajas hay?
        </span>
        {contado === null ? (
          stock.estado === "sin_senal" ? null : <Esqueleto className="h-14 rounded-control" />
        ) : (
          <div role="group" aria-labelledby="etiqueta-contadas" className="grid grid-cols-[56px_1fr_56px] items-center gap-2">
            <BotonPaso signo="menos" etiqueta="Una caja menos" disabled={contado <= 0} alPasar={() => contar(Math.max(0, contado - 1))} />
            <output aria-live="polite" className="cifra text-center text-cifra font-extrabold">
              {contado}
            </output>
            <BotonPaso signo="mas" etiqueta="Una caja más" alPasar={() => contar(contado + 1)} />
          </div>
        )}
      </div>

      {veredicto?.tipo === "cuadra" && sinTocar && cajasApp !== null ? (
        <p role="status" className="mx-1 flex animate-pieza items-start gap-2 text-lg" style={pieza(2)}>
          <Info aria-hidden className="mt-0.5 size-6 shrink-0 text-acento-texto" />
          <span>{invitacionAContar(cajasApp)}</span>
        </p>
      ) : veredicto && cajasApp !== null && (
        <p role="status" className="mx-1 flex animate-pieza items-start gap-2 text-lg" style={pieza(2)}>
          {veredicto.tipo === "cuadra" ? (
            <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-exito" />
          ) : (
            <TriangleAlert aria-hidden className={cn("mt-0.5 size-6 shrink-0", veredicto.tipo === "faltan" ? "text-deuda" : "text-acento-texto")} />
          )}
          <span>
            <strong>{veredicto.texto}.</strong> {veredicto.tipo === "cuadra" ? `${formatearCajas(cajasApp)} de ${producto.nombre}.` : segunLaApp(cajasApp)}
          </span>
        </p>
      )}

      {causas.length > 0 && (
        <div className="grid animate-pieza gap-1.5" style={pieza(3)}>
          <p className="mx-1 font-bold text-texto-suave">{dif !== null && dif > 0 ? "¿Por qué sobran?" : "¿Por qué faltan?"}</p>
          <GrupoOpciones<CausaConteo>
            pregunta={dif !== null && dif > 0 ? "¿Por qué sobran?" : "¿Por qué faltan?"}
            columnas={1}
            opciones={causas}
            elegido={borrador.causa}
            alCambiar={(causa) => setBorrador((b) => ({ ...b, causa }))}
          />
          {efectoDeCausa(borrador.causa) && <p className="mx-1 text-texto-suave">{efectoDeCausa(borrador.causa)}</p>}
        </div>
      )}

      <PieConfirmar
        style={pieza(4)}
        aviso={frasesFaltaConteo(falta, dif)}
        avisoNeutro={aMano && !falta.includes("stock")}
        error={error}
        guardando={guardando}
        listo={falta.length === 0}
        etiqueta="Confirmar conteo"
        alConfirmar={() => confirmar("toque")}
        nota={notaDeVoz(voz)}
        alDescartar={() => alDescartar(incierto.current)}
      />
    </div>
  );
}
