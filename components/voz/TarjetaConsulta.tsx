"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Volume2 } from "lucide-react";

import { responderConsulta } from "@/app/(app)/acciones-consultas";
import { buscarClientes, buscarProductos } from "@/app/(app)/acciones-voz";
import { Avatar } from "@/components/ui/Avatar";
import { Boton } from "@/components/ui/Boton";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Monto } from "@/components/ui/Monto";
import { formatearCajas } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import type { Respuesta } from "@/lib/voz/consultas-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { EditorBusqueda } from "./EditorBusqueda";
import { callar, hablar } from "./hablar";

type Consulta = Extract<Tarjeta, { tipo: "consulta" }>;

type Props = {
  tarjeta: Consulta;
  comandoId: number;
  latenciaMs: number;
  /** La persona terminó de leer (o de oír): la hoja se cierra sin aviso, porque no había nada que guardar. */
  alListo: () => void;
};

const pieza = (n: number) => ({ animationDelay: `${120 + n * 55}ms` });

type Eleccion = { clienteId: number | null; productoId: number | null; /** El nombre de lo elegido, para «dijiste …». */ nombre: string | null };
const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

/** Lo que falta elegir antes de poder responder: de quién es la deuda o de qué fruta es el stock. */
function faltaElegir(consulta: Consulta["consulta"], e: Eleccion): "cliente" | "producto" | null {
  if (consulta === "deuda_cliente" && e.clienteId === null) return "cliente";
  if (consulta === "stock_producto" && e.productoId === null) return "producto";
  return null;
}

// La respuesta a una pregunta dictada («¿quién me debe?»): un veredicto en grande, el detalle debajo, y dicha en voz alta
// al abrir (CLAUDE.md, «La voz»). Si la respuesta no llegó con la tarjeta, se pide aquí: la pregunta no se pierde. Si el
// nombre no se entendió bien («¿cuánto me debe la del puesto?»), primero se elige de la lista y después se responde.
export function TarjetaConsulta({ tarjeta, comandoId, latenciaMs, alListo }: Props) {
  const inicial: Eleccion = {
    clienteId: tarjeta.cliente?.elegido?.id ?? null,
    productoId: tarjeta.producto?.elegido?.id ?? null,
    nombre: tarjeta.cliente?.elegido?.nombre ?? tarjeta.producto?.elegido?.nombre ?? null,
  };
  const falta = faltaElegir(tarjeta.consulta, inicial);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(tarjeta.respuesta);
  const [estado, setEstado] = useState<"listo" | "eligiendo" | "pidiendo" | "sin_respuesta" | "error">(
    tarjeta.respuesta ? "listo" : falta ? "eligiendo" : "pidiendo",
  );
  const [eleccion, setEleccion] = useState(inicial);
  const [error, setError] = useState<string | null>(null);

  async function pedir(e: Eleccion = eleccion) {
    setEleccion(e);
    setEstado("pidiendo");
    const r = await responderConsulta({ comandoId, consulta: tarjeta.consulta, clienteId: e.clienteId, productoId: e.productoId, latenciaMs }).catch(() => ({ ok: false as const, error: "No pude leer tu cuaderno. Revisa tu señal e inténtalo otra vez." }));
    if (!r.ok) {
      setError(r.error);
      setEstado("error");
      return;
    }
    setRespuesta(r.respuesta);
    setEstado(r.respuesta ? "listo" : "sin_respuesta");
  }

  useEffect(() => {
    if (tarjeta.respuesta || falta) return;
    // La respuesta no llegó con la tarjeta: se pide una vez al abrir.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedir() cambia el estado al responder, no antes de pintar
    void pedir();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir la tarjeta
  }, []);

  // Dicha en voz alta apenas llega; se calla si la hoja se cierra.
  useEffect(() => {
    if (respuesta) hablar(respuesta.hablado);
    return callar;
  }, [respuesta]);

  if (estado === "pidiendo") {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Esqueleto className="h-24" />
        <Esqueleto className="h-40" />
      </div>
    );
  }

  if (estado === "eligiendo") {
    const opcion = falta === "cliente" ? tarjeta.cliente : tarjeta.producto;
    return falta === "cliente" ? (
      <EditorBusqueda
        etiqueta="¿De quién me preguntas?"
        inicial={opcion?.dicho ?? ""}
        opciones={(opcion?.opciones ?? []).map((o) => ({ ...o, detalle: null }))}
        buscar={buscarClientes}
        alElegir={(o) => void pedir({ ...eleccion, clienteId: o.id, nombre: o.nombre })}
        icono={(o) => <Avatar iniciales={iniciales(o.nombre)} tono={tonoDe(o.id)} />}
        sinResultados="No encuentro a nadie así. Prueba con otro nombre o apodo."
      />
    ) : (
      <EditorBusqueda
        etiqueta="¿De qué fruta me preguntas?"
        inicial={opcion?.dicho ?? ""}
        opciones={(opcion?.opciones ?? []).map((o) => ({ ...o, detalle: null }))}
        buscar={buscarProductos}
        alElegir={(o) => void pedir({ ...eleccion, productoId: o.id, nombre: o.nombre })}
        icono={(o) => <IconoFruta nombre={o.nombre} tamano={40} />}
        sinResultados="No encuentro esa fruta. Prueba con otro nombre."
      />
    );
  }

  if (estado !== "listo" || !respuesta) {
    return (
      <div className="grid gap-4">
        <p className="text-lg" role={estado === "error" ? "alert" : undefined}>
          {estado === "error" ? error : "Esa pregunta todavía no la sé responder. Pregúntame cuánto vendiste, quién te debe o cuánto te queda."}
        </p>
        {estado === "error" && (
          <Boton variante="secundario" onClick={() => void pedir()}>
            Intentar otra vez
          </Boton>
        )}
        <Boton onClick={alListo}>Entendido</Boton>
      </div>
    );
  }

  const { cifra } = respuesta;
  // Lo que dijo, si no es igual al nombre del cuaderno: «Luis Paredes» puede no sonarle a «don Lucho» (/formidable 2026-10-31).
  const dicho = tarjeta.consulta === "deuda_cliente" ? tarjeta.cliente?.dicho : tarjeta.consulta === "stock_producto" ? tarjeta.producto?.dicho : null;
  const decirDicho = dicho && eleccion.nombre && !mismoNombre(dicho, eleccion.nombre) ? `dijiste «${dicho}»` : null;
  // Una sola columna que no crece más que la hoja: con «auto», un nombre largo y su monto la estiraban y a 360 px
  // se cortaban la lista y «Listo» (captura del 31-10).
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="mx-1 grid animate-pieza gap-0.5" style={pieza(0)}>
        <p className="text-lg font-bold text-texto-suave">{respuesta.etiqueta}</p>
        {decirDicho && <p className="text-texto-suave">{decirDicho}</p>}
        {cifra &&
          (cifra.tipo === "soles" ? (
            <Monto valor={cifra.valor} tamano="total" tono={cifra.tono} />
          ) : (
            <p className="cifra text-total font-extrabold">{formatearCajas(cifra.valor)}</p>
          ))}
        {respuesta.detalle && <p className="text-lg">{respuesta.detalle}</p>}
      </div>

      {respuesta.filas.length > 0 && (
        <ul className="grid animate-pieza grid-cols-[minmax(0,1fr)] gap-1 rounded-[20px] bg-superficie p-2" style={pieza(1)}>
          {respuesta.filas.map((f) => (
            <li key={f.id} className="flex min-h-14 items-center gap-3 px-1.5">
              {f.icono === "cliente" && <Avatar iniciales={iniciales(f.nombre)} tono={tonoDe(f.id)} />}
              {f.icono === "fruta" && <IconoFruta nombre={f.nombre} tamano={40} />}
              <span className="min-w-0 flex-1 truncate text-lg font-bold">{f.nombre}</span>
              {/* El monto no se achica: si falta espacio, se corta el nombre, nunca la cifra. */}
              <span className={f.tono === "deuda" ? "cifra shrink-0 text-lg font-extrabold text-deuda" : "cifra shrink-0 text-lg font-extrabold"}>{f.valor}</span>
            </li>
          ))}
        </ul>
      )}

      {respuesta.enlace && (
        <Link
          href={respuesta.enlace.href}
          onClick={alListo}
          className="mx-1 flex min-h-12 animate-pieza items-center justify-between gap-2 font-extrabold text-acento-texto"
          style={pieza(2)}
        >
          {respuesta.enlace.texto}
          <ChevronRight aria-hidden />
        </Link>
      )}

      <div className="mt-1 grid animate-pieza grid-cols-2 gap-2" style={pieza(3)}>
        <Boton variante="secundario" onClick={() => hablar(respuesta.hablado)}>
          <Volume2 aria-hidden />
          Escuchar
        </Boton>
        <Boton onClick={alListo}>Listo</Boton>
      </div>
    </div>
  );
}
