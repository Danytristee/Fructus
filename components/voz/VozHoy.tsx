"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { borrarPendiente, guardarPendiente, leerPendiente } from "@/lib/voz/audio-pendiente";
import { DURACION_MINIMA_MS, desenlaceDeRespuesta, desenlaceSinRed, type Desenlace } from "@/lib/voz/envio-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { AvisoVoz } from "./AvisoVoz";
import { BotonVoz, type EstadoVoz } from "./BotonVoz";
import { useGrabadora, type FallaGrabadora, type Grabacion } from "./useGrabadora";

// La hoja llega recién cuando hay tarjeta: no pesa en la primera carga de «Hoy» (CLAUDE.md, presupuesto de JavaScript).
const HojaVoz = dynamic(() => import("./HojaVoz").then((m) => m.HojaVoz), { ssr: false });

const TEXTO_LISTO = "Mantén para hablar";
// Marca local del dispositivo: ya usó el botón una vez. Es solo comodidad de interfaz; si se borra, la ayuda vuelve.
const MARCA_APRENDIO = "fructus:voz-aprendida";
// Whisper con respaldo, más el intérprete con respaldo: el servidor puede tardar hasta ~20 s en el peor caso.
const TOPE_ENVIO_MS = 25_000;

const POR_FALLA: Record<FallaGrabadora, string> = {
  sin_permiso: "Necesito el micrófono. Dale permiso en el candado de arriba, junto a la dirección.",
  sin_microfono: "No encuentro el micrófono de tu celular.",
  no_soportado: "Este navegador no puede grabar. Abre Fructus en Chrome.",
};

export type ResultadoVoz = { comandoId: number; tarjeta: Tarjeta; latenciaMs: number };
type Aviso = { mensaje: string; pendiente: boolean };

async function enviarAudio({ audio, duracionMs }: Grabacion): Promise<Desenlace> {
  if (!navigator.onLine) return desenlaceSinRed();
  const formulario = new FormData();
  formulario.append("audio", audio, audio.type.includes("mp4") ? "voz.m4a" : "voz.webm");
  formulario.append("duracion_ms", String(duracionMs));
  try {
    const r = await fetch("/api/voz", { method: "POST", body: formulario, signal: AbortSignal.timeout(TOPE_ENVIO_MS) });
    return desenlaceDeRespuesta(r.status, await r.json().catch(() => null));
  } catch (e) {
    console.error("voz: no se pudo enviar el audio", { error: e instanceof Error ? e.name : "desconocido" });
    return desenlaceSinRed();
  }
}

/**
 * El botón de voz de «Hoy», encajado al centro de la barra de abajo, en la zona del pulgar (CLAUDE.md, regla 1).
 * Mantener → hablar → soltar → la tarjeta en una hoja. Si algo falla, dice qué hacer y guarda el audio para reintentarlo.
 */
export function VozHoy() {
  const [estado, setEstado] = useState<EstadoVoz>("listo");
  const [texto, setTexto] = useState(TEXTO_LISTO);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // Arranca oculta: quien ya aprendió no la ve parpadear. Si es su primera vez, aparece enseguida.
  const [aprendio, setAprendio] = useState(true);
  const grabadora = useGrabadora();
  const presionado = useRef(false);
  const reloj = useRef(0);
  const vuelta = useRef(0);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      try {
        setAprendio(localStorage.getItem(MARCA_APRENDIO) === "si");
      } catch {
        setAprendio(false); // sin almacenamiento (modo privado): se enseña siempre
      }
    });
    // Un audio que no salió la última vez: se ofrece enviarlo apenas se abre «Hoy».
    void leerPendiente().then((p) => p && setAviso({ mensaje: "Tienes un audio que no se pudo enviar.", pendiente: true }));
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearInterval(reloj.current);
      window.clearTimeout(vuelta.current);
    };
  }, []);

  function decir(mensaje: string, volverEn = 2500) {
    window.clearTimeout(vuelta.current);
    setTexto(mensaje);
    vuelta.current = window.setTimeout(() => setTexto(TEXTO_LISTO), volverEn);
  }

  async function presionar() {
    if (presionado.current || estado === "entendiendo") return;
    presionado.current = true;
    try {
      localStorage.setItem(MARCA_APRENDIO, "si");
    } catch {
      // Sin almacenamiento la ayuda seguirá apareciendo; no pasa nada más.
    }
    window.clearTimeout(vuelta.current);
    setAprendio(true);
    setAviso(null);
    setEstado("escuchando");
    navigator.vibrate?.(20);
    const inicio = Date.now();
    setTexto("Te escucho… 0:00");
    reloj.current = window.setInterval(() => {
      setTexto(`Te escucho… 0:${String(Math.floor((Date.now() - inicio) / 1000)).padStart(2, "0")}`);
    }, 250);
    const falla = await grabadora.empezar();
    if (falla) {
      presionado.current = false;
      window.clearInterval(reloj.current);
      setEstado("listo");
      setTexto(TEXTO_LISTO);
      setAviso({ mensaje: POR_FALLA[falla], pendiente: false });
    }
  }

  async function soltar() {
    if (!presionado.current) return;
    presionado.current = false;
    window.clearInterval(reloj.current);
    const grabacion = await grabadora.terminar();
    if (grabacion.duracionMs < DURACION_MINIMA_MS || grabacion.audio.size === 0) {
      setEstado("listo");
      decir("Mantén el botón mientras hablas");
      return;
    }
    navigator.vibrate?.(10);
    await enviar(grabacion);
  }

  async function enviar(grabacion: Grabacion) {
    setEstado("entendiendo");
    window.clearTimeout(vuelta.current);
    setTexto("Entendiendo…");
    const desde = performance.now();
    const desenlace = await enviarAudio(grabacion);
    setEstado("listo");
    if (desenlace.tipo === "tarjeta") {
      void borrarPendiente();
      // De soltar el botón a ver la tarjeta (CLAUDE.md, regla 9): se guarda al confirmar o descartar.
      setResultado({ comandoId: desenlace.comandoId, tarjeta: desenlace.tarjeta, latenciaMs: Math.round(performance.now() - desde) });
      setHojaAbierta(true);
      decir("Listo", 1200);
      return;
    }
    if (desenlace.conservarAudio) await guardarPendiente(grabacion.audio, grabacion.duracionMs);
    else void borrarPendiente();
    setTexto(TEXTO_LISTO);
    setAviso({ mensaje: desenlace.mensaje, pendiente: desenlace.conservarAudio });
  }

  async function reintentar() {
    const pendiente = await leerPendiente();
    setAviso(null);
    if (!pendiente) return decir("Ese audio ya no está. Dilo otra vez.");
    await enviar({ audio: pendiente.audio, duracionMs: pendiente.duracionMs });
  }

  return (
    // Encajado en el centro de la barra de abajo: el orbe asoma por encima y la barra le abre su hueco (data-voz-fijo).
    <div
      data-voz-fijo
      className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-3"
    >
      {aviso && (
        <AvisoVoz
          mensaje={aviso.mensaje}
          pendiente={aviso.pendiente}
          alReintentar={reintentar}
          alCerrar={() => {
            if (aviso.pendiente) void borrarPendiente();
            setAviso(null);
          }}
        />
      )}
      <BotonVoz
        estado={estado}
        texto={texto}
        // La etiqueta enseña el primer día y acompaña mientras escucha; después no tapa «Lo último» (/formidable 2026-10-28).
        verTexto={!aviso && (!aprendio || estado !== "listo" || texto !== TEXTO_LISTO)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void presionar();
        }}
        onPointerUp={() => void soltar()}
        onPointerCancel={() => void soltar()}
        // Con teclado: mantener Espacio o Enter es como mantener el dedo.
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            void presionar();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") void soltar();
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {resultado && <HojaVoz resultado={resultado} abierta={hojaAbierta} alCambiar={setHojaAbierta} />}
    </div>
  );
}
