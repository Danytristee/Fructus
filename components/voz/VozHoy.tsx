"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Eye, RotateCcw, Undo2 } from "lucide-react";

import { descartarComando } from "@/app/(app)/acciones-voz";
import { useCola } from "@/components/cola/ColaProveedor";

import { borrarPendiente, guardarPendiente, leerPendiente } from "@/lib/voz/audio-pendiente";
import { avisoDescarte, nombreOperacion } from "@/lib/voz/nombre-operacion-reglas";
import { DURACION_MINIMA_MS, desenlaceDeRespuesta, desenlaceSinRed, type Desenlace } from "@/lib/voz/envio-reglas";
import { REPOSO, TOPE_ESCUCHA_MS, avanceAlCandado, siguienteGesto, textoEscuchando, type EventoGesto, type Gesto } from "@/lib/voz/gesto-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { AvisoCola } from "./AvisoCola";
import { AvisoVoz } from "./AvisoVoz";
import { BotonVoz, type EstadoVoz } from "./BotonVoz";
import { useGrabadora, type FallaGrabadora, type Grabacion } from "./useGrabadora";

// La hoja llega recién cuando hay tarjeta: no pesa en la primera carga de «Hoy» (CLAUDE.md, presupuesto de JavaScript).
const HojaVoz = dynamic(() => import("./HojaVoz").then((m) => m.HojaVoz), { ssr: false });

const TEXTO_LISTO = "Toca o mantén para hablar";
// Grabó menos de DURACION_MINIMA_MS: casi siempre empezó a hablar antes de «Te escucho» o tocó dos veces seguidas.
const TEXTO_CORTO = "No alcancé a oírte. Habla después de «Te escucho».";
// Marca local del dispositivo: ya usó el botón una vez. Es solo comodidad de interfaz; si se borra, la ayuda vuelve.
const MARCA_APRENDIO = "fructus:voz-aprendida";
// Whisper con respaldo, más el intérprete con respaldo: el servidor puede tardar hasta ~20 s en el peor caso.
const TOPE_ENVIO_MS = 25_000;
// Lo que dura el «Deshacer» después de cerrar una tarjeta sin guardar (ley 7: perdonar antes que preguntar).
const DESHACER_MS = 5_000;
// La última tarjeta sin confirmar, en esta pestaña: sobrevive a una recarga o a volver a entrar (principio 8: nunca se
// pierde lo dictado; /chaos 2026-10-29). Si se confirma dos veces, registrar_venta devuelve la misma venta.
const TARJETA_ABIERTA = "fructus:voz-tarjeta";

function recordarTarjeta(r: ResultadoVoz | null) {
  try {
    if (r) sessionStorage.setItem(TARJETA_ABIERTA, JSON.stringify(r));
    else sessionStorage.removeItem(TARJETA_ABIERTA);
  } catch {
    // Sin almacenamiento, una recarga pierde la tarjeta; el comando queda «pendiente» y se dicta otra vez.
  }
}

function tarjetaRecordada(): ResultadoVoz | null {
  try {
    const t = sessionStorage.getItem(TARJETA_ABIERTA);
    return t ? (JSON.parse(t) as ResultadoVoz) : null;
  } catch {
    return null;
  }
}

const POR_FALLA: Record<FallaGrabadora, string> = {
  sin_permiso: "Necesito el micrófono. Dale permiso en el candado de arriba, junto a la dirección.",
  sin_microfono: "No encuentro el micrófono de tu celular.",
  no_soportado: "Este navegador no puede grabar. Abre Fructus en Chrome.",
};

export type ResultadoVoz = { comandoId: number; tarjeta: Tarjeta; latenciaMs: number };
type Aviso = { tipo: "error"; mensaje: string; pendiente: boolean } | { tipo: "en_cola" } | { tipo: "descartada"; incierto: boolean; que: string } | { tipo: "sin_confirmar"; resultado: ResultadoVoz };

// Un audio dictado sin señal va a la cola del celular (ADR-0019): vuelve como tarjeta cuando haya señal.
const EN_COLA = "Sin señal: guardé lo que dijiste. Cuando vuelva, te muestro la tarjeta para que la confirmes.";

/** «sin_red»: no salió del celular (o no hubo respuesta). Lo demás, lo que contestó el servidor. */
async function enviarAudio({ audio, duracionMs }: Grabacion): Promise<Desenlace | "sin_red"> {
  if (!navigator.onLine) return "sin_red";
  const formulario = new FormData();
  formulario.append("audio", audio, audio.type.includes("mp4") ? "voz.m4a" : "voz.webm");
  formulario.append("duracion_ms", String(duracionMs));
  try {
    const r = await fetch("/api/voz", { method: "POST", body: formulario, signal: AbortSignal.timeout(TOPE_ENVIO_MS) });
    return desenlaceDeRespuesta(r.status, await r.json().catch(() => null));
  } catch (e) {
    console.error("voz: no se pudo enviar el audio", { error: e instanceof Error ? e.name : "desconocido" });
    return "sin_red";
  }
}

/**
 * El botón de voz de «Hoy», encajado al centro de la barra de abajo, en la zona del pulgar (CLAUDE.md, regla 1).
 * Mantener → hablar → soltar, o tocar → hablar → tocar o callarse (lib/voz/gesto-reglas.ts) → la tarjeta en una hoja. Si algo falla,
 * dice qué hacer y guarda el audio para reintentarlo.
 */
export function VozHoy() {
  const [estado, setEstado] = useState<EstadoVoz>("listo");
  const [texto, setTexto] = useState(TEXTO_LISTO);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [resultado, setResultado] = useState<ResultadoVoz | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // Arranca oculta: quien ya aprendió no la ve parpadear. Si es su primera vez, aparece enseguida.
  const [aprendio, setAprendio] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  // Cuánto subió el dedo hacia el candado (0 a 1) y desde qué altura bajó.
  const [avance, setAvance] = useState(0);
  const inicioY = useRef(0);
  // Sin el dedo encima, callarse envía lo dicho (lib/voz/gesto-reglas.ts); manteniendo, no.
  const grabadora = useGrabadora({ alCallarse: () => aplicar({ tipo: "silencio" }) });
  const cola = useCola();
  // La tarjeta abierta vino de la cola (un dictado sin señal que ya volvió): se saca de la cola al guardarla o descartarla.
  const desdeCola = useRef<number | null>(null);
  const audiosEnCola = cola?.entradas.filter((e) => e.contenido.clase === "audio" && e.estado === "pendiente").length ?? 0;
  const gesto = useRef<Gesto>(REPOSO);
  // Mientras se envía un audio el orbe no acepta otro (antes lo decía `estado`, pero el tope llama desde un reloj viejo).
  const enviando = useRef(false);
  const reloj = useRef(0);
  const tope = useRef(0);
  const vuelta = useRef(0);
  // El comando cerrado sin guardar: se marca descartado cuando vence el «Deshacer» (o antes, si se dicta otro).
  const descarte = useRef<{ comandoId: number; latenciaMs: number; reloj: number; colaId: number | null } | null>(null);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      try {
        setAprendio(localStorage.getItem(MARCA_APRENDIO) === "si");
      } catch {
        setAprendio(false); // sin almacenamiento (modo privado): se enseña siempre
      }
      const abierta = tarjetaRecordada();
      if (abierta) setAviso({ tipo: "sin_confirmar", resultado: abierta });
    });
    // Un audio que no salió la última vez: se ofrece enviarlo apenas se abre «Hoy».
    void leerPendiente().then((p) => p && setAviso((a) => a ?? { tipo: "error", mensaje: "Tienes un audio que no se pudo enviar.", pendiente: true }));
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearInterval(reloj.current);
      window.clearTimeout(vuelta.current);
      window.clearTimeout(tope.current);
      cerrarDescarte(); // se fue de «Hoy» con el «Deshacer» abierto: el descarte vale
    };
  }, []);

  function cerrarDescarte() {
    const d = descarte.current;
    if (!d) return;
    descarte.current = null;
    window.clearTimeout(d.reloj);
    if (d.colaId !== null) void cola?.quitar(d.colaId);
    else recordarTarjeta(null);
    void descartarComando(d.comandoId, d.latenciaMs).catch(() => {
      // Sin red el comando queda «pendiente»: no guarda nada y solo cuenta distinto en la precisión.
    });
  }

  function alCerrarHoja(motivo: "guardada" | "descartada", incierto = false) {
    setHojaAbierta(false);
    const colaId = desdeCola.current;
    desdeCola.current = null;
    if (motivo === "guardada") {
      if (colaId !== null) void cola?.quitar(colaId);
      else recordarTarjeta(null);
    }
    if (motivo === "guardada" || !resultado || descarte.current) return;
    const { comandoId, latenciaMs } = resultado;
    const reloj = window.setTimeout(() => {
      cerrarDescarte();
      setAviso((a) => (a?.tipo === "descartada" ? null : a));
    }, DESHACER_MS);
    descarte.current = { comandoId, latenciaMs, reloj, colaId };
    setAviso({ tipo: "descartada", incierto, que: resultado.tarjeta.tipo });
  }

  function deshacer() {
    const d = descarte.current;
    if (d) window.clearTimeout(d.reloj);
    descarte.current = null;
    desdeCola.current = d?.colaId ?? null;
    setAviso(null);
    setHojaAbierta(true);
  }

  /** Abre la tarjeta de un dictado que se envió desde la cola. */
  function abrirDeLaCola(id: number, r: ResultadoVoz) {
    cerrarDescarte();
    desdeCola.current = id;
    setResultado(r);
    setAviso(null);
    setHojaAbierta(true);
  }

  function decir(mensaje: string, volverEn = 2500) {
    window.clearTimeout(vuelta.current);
    setTexto(mensaje);
    vuelta.current = window.setTimeout(() => setTexto(TEXTO_LISTO), volverEn);
  }

  /** Un paso del gesto (lib/voz/gesto-reglas.ts) y lo que pide hacer con el micrófono. */
  function aplicar(e: EventoGesto) {
    if (enviando.current) return;
    const r = siguienteGesto(gesto.current, e);
    gesto.current = r.gesto;
    if (r.efecto === "empezar") void empezar();
    else if (r.efecto === "bloquear") {
      setBloqueado(true);
      setAvance(0);
      navigator.vibrate?.(15);
    } else if (r.efecto === "enviar") void terminar(true);
    else if (r.efecto === "descartar") void terminar(false);
  }

  async function empezar() {
    try {
      localStorage.setItem(MARCA_APRENDIO, "si");
    } catch {
      // Sin almacenamiento la ayuda seguirá apareciendo; no pasa nada más.
    }
    window.clearTimeout(vuelta.current);
    cerrarDescarte();
    setAprendio(true);
    setAviso(null);
    const falla = await grabadora.empezar();
    if (falla) {
      gesto.current = REPOSO;
      setBloqueado(false);
      setAviso({ tipo: "error", mensaje: POR_FALLA[falla], pendiente: false });
      return;
    }
    if (gesto.current.fase === "reposo") return; // soltó, envió o canceló antes de que el micrófono arrancara
    // «Te escucho» y la vibración recién cuando el micrófono graba (unos 200 ms después del toque): son la señal para
    // hablar. Si se mostraran al toque, el «Vendí…» del principio podía quedar fuera del audio.
    setEstado("escuchando");
    navigator.vibrate?.(20);
    const inicio = Date.now();
    const contar = () => setTexto(textoEscuchando((Date.now() - inicio) / 1000));
    contar();
    reloj.current = window.setInterval(contar, 250);
    tope.current = window.setTimeout(() => aplicar({ tipo: "tope" }), TOPE_ESCUCHA_MS);
  }

  /** Apaga el micrófono y envía lo grabado, o lo tira si se canceló. */
  async function terminar(enviarlo: boolean) {
    window.clearInterval(reloj.current);
    window.clearTimeout(tope.current);
    setBloqueado(false);
    setAvance(0);
    const grabacion = await grabadora.terminar();
    if (!enviarlo) {
      setEstado("listo");
      decir("Cancelado. No se envió nada.");
      return;
    }
    if (grabacion.duracionMs < DURACION_MINIMA_MS || grabacion.audio.size === 0) {
      setEstado("listo");
      decir(TEXTO_CORTO, 3500);
      return;
    }
    navigator.vibrate?.(10);
    await enviar(grabacion);
  }

  async function enviar(grabacion: Grabacion) {
    enviando.current = true;
    try {
      await entender(grabacion);
    } finally {
      enviando.current = false;
    }
  }

  async function entender(grabacion: Grabacion) {
    setEstado("entendiendo");
    window.clearTimeout(vuelta.current);
    setTexto("Entendiendo…");
    const desde = performance.now();
    const respuesta = await enviarAudio(grabacion);
    setEstado("listo");
    if (respuesta === "sin_red" && cola && (await cola.encolar({ clase: "audio", ...grabacion }, "Un dictado"))) {
      void borrarPendiente();
      setTexto(TEXTO_LISTO);
      setAviso({ tipo: "en_cola" });
      return;
    }
    const desenlace = respuesta === "sin_red" ? desenlaceSinRed() : respuesta;
    if (desenlace.tipo === "tarjeta") {
      void borrarPendiente();
      // De soltar el botón a ver la tarjeta (CLAUDE.md, regla 9): se guarda al confirmar o descartar.
      const nuevo = { comandoId: desenlace.comandoId, tarjeta: desenlace.tarjeta, latenciaMs: Math.round(performance.now() - desde) };
      setResultado(nuevo);
      // Una pregunta no queda «sin confirmar»: no hay nada que guardar si se recarga la página.
      if (nuevo.tarjeta.tipo !== "consulta") recordarTarjeta(nuevo);
      setHojaAbierta(true);
      decir("Listo", 1200);
      return;
    }
    if (desenlace.conservarAudio) await guardarPendiente(grabacion.audio, grabacion.duracionMs);
    else void borrarPendiente();
    setTexto(TEXTO_LISTO);
    setAviso({ tipo: "error", mensaje: desenlace.mensaje, pendiente: desenlace.conservarAudio });
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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-3 lg:bottom-8 lg:left-[264px]"
    >
      {aviso?.tipo === "error" && (
        <AvisoVoz
          tono="error"
          mensaje={aviso.mensaje}
          accion={aviso.pendiente ? { etiqueta: "Reintentar", icono: <RotateCcw aria-hidden className="size-5" />, alTocar: reintentar } : undefined}
          cerrar={{
            etiqueta: aviso.pendiente ? "Borrar el audio guardado" : "Cerrar el aviso",
            alTocar: () => {
              if (aviso.pendiente) void borrarPendiente();
              setAviso(null);
            },
          }}
        />
      )}
      {/* Mientras el dictado siga esperando señal; cuando vuelve como tarjeta, lo reemplaza el aviso de la cola. */}
      {aviso?.tipo === "en_cola" && audiosEnCola > 0 && (
        <AvisoVoz tono="info" mensaje={EN_COLA} cerrar={{ etiqueta: "Cerrar el aviso", alTocar: () => setAviso(null) }} />
      )}
      {(!aviso || (aviso.tipo === "en_cola" && audiosEnCola === 0)) && !hojaAbierta && <AvisoCola alAbrir={abrirDeLaCola} />}
      {aviso?.tipo === "sin_confirmar" && (
        <AvisoVoz
          tono="info"
          mensaje={`Tienes ${nombreOperacion(aviso.resultado.tarjeta.tipo).uno} sin confirmar.`}
          accion={{
            etiqueta: "Verla",
            icono: <Eye aria-hidden className="size-5" />,
            alTocar: () => {
              setResultado(aviso.resultado);
              setAviso(null);
              setHojaAbierta(true);
            },
          }}
          cerrar={{
            etiqueta: `Descartar ${nombreOperacion(aviso.resultado.tarjeta.tipo).ese}`,
            alTocar: () => {
              recordarTarjeta(null);
              void descartarComando(aviso.resultado.comandoId, aviso.resultado.latenciaMs).catch(() => {});
              setAviso(null);
            },
          }}
        />
      )}
      {aviso?.tipo === "descartada" && (
        <AvisoVoz
          tono="info"
          mensaje={avisoDescarte(aviso.que, aviso.incierto)}
          accion={{ etiqueta: "Deshacer", icono: <Undo2 aria-hidden className="size-5" />, alTocar: deshacer }}
          cerrar={{
            etiqueta: "Cerrar el aviso",
            alTocar: () => {
              cerrarDescarte();
              setAviso(null);
            },
          }}
        />
      )}
      <BotonVoz
        estado={estado}
        texto={texto}
        // La etiqueta enseña el primer día y acompaña mientras escucha; después no tapa «Lo último» (/formidable 2026-10-28).
        verTexto={!aviso && (!aprendio || estado !== "listo" || texto !== TEXTO_LISTO)}
        bloqueado={bloqueado}
        alCancelar={bloqueado ? () => aplicar({ tipo: "cancelar" }) : undefined}
        candado={estado === "escuchando" && !bloqueado ? avance : undefined}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          inicioY.current = e.clientY;
          aplicar({ tipo: "bajar", en: e.timeStamp });
        }}
        onPointerMove={(e) => {
          if (gesto.current.fase !== "presionado") return;
          const subida = inicioY.current - e.clientY;
          setAvance(avanceAlCandado(subida)); // en pasos de 0.1: React no vuelve a dibujar si el paso no cambió
          aplicar({ tipo: "deslizar", subida });
        }}
        onPointerUp={(e) => aplicar({ tipo: "subir", en: e.timeStamp })}
        onPointerCancel={() => aplicar({ tipo: "perder" })}
        // Con teclado: mantener Espacio o Enter es como mantener el dedo; pulsarlo una vez, como un toque.
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            aplicar({ tipo: "bajar", en: e.timeStamp });
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") aplicar({ tipo: "subir", en: e.timeStamp });
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {resultado && <HojaVoz resultado={resultado} abierta={hojaAbierta} alCerrar={alCerrarHoja} />}
    </div>
  );
}
