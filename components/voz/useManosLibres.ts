"use client";

import { useEffect, useRef, useState } from "react";

import {
  CALLADO,
  GUARDADO,
  REPREGUNTA,
  REPREGUNTA_PAGO,
  SILENCIO_RESPUESTA_MS,
  TOPE_RESPUESTA_MS,
  VENTANA_RESPUESTA_MS,
  leyendo,
  notaManosLibres,
  siguienteManosLibres,
  type EfectoManosLibres,
  type EventoManosLibres,
  type Pregunta,
} from "@/lib/voz/manos-libres-reglas";
import type { VentaActual } from "@/lib/voz/esquemas";
import type { Guion, GuionCorregido, Relectura } from "@/lib/voz/lectura-reglas";
import type { Pago } from "@/lib/voz/respuesta-reglas";
import type { Tarjeta } from "@/lib/voz/tarjeta-reglas";
import { callar, hablar } from "./hablar";
import { vibrar } from "./senales";
import { useGrabadora } from "./useGrabadora";

// La respuesta pasa por Whisper (con su respaldo): más que esto y se deja para tocar.
const TOPE_ENVIO_MS = 10_000;
const MEDIOS = ["efectivo", "yape", "plin", "transferencia"];

type Venta = Extract<Tarjeta, { tipo: "venta" }>;
/** Lo que entendió el servidor, y la tarjeta corregida cuando la respuesta fue una corrección («no, son ocho cajas»). */
type Entendido = { ev: EventoManosLibres; corregida?: Venta };

/** Lo que dijo el servidor del pago, revisado: lo que no tenga la forma esperada no se anota (nunca se asume contado). */
function leerPago(x: unknown): Pago | null {
  const p = x as { condicion?: unknown; medio?: unknown } | null;
  if (p?.condicion === "credito") return { condicion: "credito", medio: null };
  if (p?.condicion === "contado" && typeof p.medio === "string" && MEDIOS.includes(p.medio)) return { condicion: "contado", medio: p.medio as Extract<Pago, { condicion: "contado" }>["medio"] };
  return null;
}

/**
 * Lo que el servidor entendió de la respuesta corta, como evento. «fallo» si no respondió o no la entendió: nunca se guarda ni se
 * anota por las dudas. Sin señal se dice así, para que la tarjeta lo explique. `venta`: la venta actual, para poder corregirla.
 */
async function entender(audio: Blob, duracionMs: number, pregunta: Pregunta, venta: VentaActual | null): Promise<Entendido> {
  const formulario = new FormData();
  formulario.append("audio", audio, audio.type.includes("mp4") ? "respuesta.m4a" : "respuesta.webm");
  formulario.append("duracion_ms", String(duracionMs));
  formulario.append("pregunta", pregunta);
  if (venta && pregunta === "confirmar") formulario.append("venta", JSON.stringify(venta));
  try {
    const r = await fetch("/api/voz/respuesta", { method: "POST", body: formulario, signal: AbortSignal.timeout(TOPE_ENVIO_MS) });
    const cuerpo = (await r.json().catch(() => null)) as { respuesta?: unknown; pago?: unknown; repetir?: unknown; tarjeta?: { tipo?: unknown } } | null;
    if (r.ok && cuerpo?.repetir === true) return { ev: { tipo: "repetir" } };
    if (r.ok && pregunta === "pago" && cuerpo && "pago" in cuerpo) return { ev: { tipo: "pago", pago: leerPago(cuerpo.pago) } };
    if (r.ok && cuerpo?.respuesta === "corregir" && cuerpo.tarjeta?.tipo === "venta") {
      return { ev: { tipo: "respuesta", respuesta: "corregir" }, corregida: cuerpo.tarjeta as Venta };
    }
    if (r.ok && (cuerpo?.respuesta === "confirmar" || cuerpo?.respuesta === "otra")) return { ev: { tipo: "respuesta", respuesta: cuerpo.respuesta } };
    console.error("voz: la respuesta no se entendió", { estado: r.status });
  } catch (e) {
    console.error("voz: no se pudo enviar la respuesta", { error: e instanceof Error ? e.name : "desconocido" });
  }
  if (!navigator.onLine) return { ev: { tipo: "sin_senal" } };
  return { ev: pregunta === "pago" ? { tipo: "pago", pago: "fallo" } : { tipo: "respuesta", respuesta: "fallo" } };
}

type Opciones = {
  /** Lo que se dice al abrir la tarjeta y qué se espera oír (lib/voz/lectura-reglas.ts). null: sin manos libres, la tarjeta de siempre. */
  guion: Guion | null;
  /** Dijo «confirmo»: la misma acción que el toque. */
  alConfirmar: () => void;
  /**
   * Respondió si pagó (venta y compra): se anota en la tarjeta. Devuelve lo que se dice ahora (solo la respuesta y «¿Confirmo?»: la
   * venta se acaba de leer) y la lectura entera para «repite», o null si todavía falta algo.
   */
  alPago?: (pago: Pago) => Relectura | null;
  /**
   * Corrigió la venta hablando: la tarjeta nueva reemplaza a la de la hoja. Devuelve qué se dice ahora (solo lo que cambió) y la
   * venta entera para «repite». Solo en la venta.
   */
  alCorregir?: (corregida: Venta) => GuionCorregido;
  /** La venta de la tarjeta ahora, en los campos de registrar_venta: viaja con la respuesta para poder corregirla. Solo en la venta. */
  ventaActual?: () => VentaActual;
  /** La base respondió que se guardó: se dice «Guardado» (candado 6). Lo que quedó en el celular sin señal no cuenta. */
  guardado: boolean;
};

/**
 * Manos libres en una tarjeta (ADR-0020): dice el guion en voz alta, escucha la respuesta corta y, si dice «confirmo», llama a
 * `alConfirmar`; si respondió si pagó, lo anota con `alPago`, repite la respuesta y pregunta «¿Confirmo?». Las fases y sus reglas viven en
 * lib/voz/manos-libres-reglas.ts; aquí se habla, se abre el micrófono y se envía.
 *
 * `tomarControl`: la persona tocó la tarjeta. Se calla, se apaga el micrófono y lo que llegue del servidor ya no guarda.
 */
export function useManosLibres({ guion, alConfirmar, alPago, alCorregir, ventaActual, guardado }: Opciones) {
  const [estado, setEstado] = useState(() => (guion ? leyendo(guion.pregunta) : CALLADO));
  const actual = useRef(estado);
  const relojes = useRef<number[]>([]);
  // Cada frase y cada escucha tiene su turno: lo que llega de una vieja (una frase cortada, un envío tardío) no cuenta.
  const turno = useRef(0);
  const confirmar = useRef(alConfirmar);
  const anotar = useRef(alPago);
  const corregir = useRef(alCorregir);
  const actualDeLaTarjeta = useRef(ventaActual);
  useEffect(() => {
    confirmar.current = alConfirmar;
    anotar.current = alPago;
    corregir.current = alCorregir;
    actualDeLaTarjeta.current = ventaActual;
  });
  // Lo que se dirá después de anotar el pago o rehacer la tarjeta, y lo último que se leyó (para «repite»). Tras el pago se dice
  // corto, pero «repite» lee la venta entera: quien pide que se repita es porque se perdió algo.
  const relectura = useRef<Relectura | null>(null);
  const leido = useRef<string | null>(guion?.texto ?? null);
  // La tarjeta corregida que mandó el servidor, mientras se anota.
  const corregida = useRef<Venta | null>(null);
  const grabadora = useGrabadora({ alCallarse: () => aplicar({ tipo: "callo" }), silencioMs: SILENCIO_RESPUESTA_MS });

  function aplicar(ev: EventoManosLibres) {
    const r = siguienteManosLibres(actual.current, ev);
    actual.current = r.estado;
    setEstado(r.estado);
    ejecutar(r.efecto, ev);
  }

  function limpiarRelojes() {
    relojes.current.forEach((r) => window.clearTimeout(r));
    relojes.current = [];
  }

  function decir(texto: string) {
    const mio = ++turno.current;
    if (!hablar(texto, (completa) => mio === turno.current && aplicar({ tipo: "leida", completa }))) {
      queueMicrotask(() => mio === turno.current && aplicar({ tipo: "leida", completa: false }));
    }
  }

  async function escuchar() {
    const mio = ++turno.current;
    // Sin señal la respuesta no se puede entender (Whisper está en el servidor): ni se abre el micrófono.
    if (!navigator.onLine) return aplicar({ tipo: "sin_senal" });
    const falla = await grabadora.empezar();
    if (mio !== turno.current) return;
    if (falla) return aplicar({ tipo: "vencio" }); // sin micrófono no hay respuesta: se toca
    aplicar({ tipo: "abierto" });
    vibrar(20); // como el orbe: la señal para hablar, sin mirar
    relojes.current.push(
      // No empezó a hablar: se deja de escuchar (el silencio deja la tarjeta para tocar).
      window.setTimeout(() => !grabadora.hablo() && aplicar({ tipo: "vencio" }), VENTANA_RESPUESTA_MS),
      // Habló, pero no se calla (ruido de fondo): lo dicho hasta aquí se envía.
      window.setTimeout(() => aplicar({ tipo: "callo" }), TOPE_RESPUESTA_MS),
    );
  }

  async function enviar() {
    limpiarRelojes();
    const mio = ++turno.current;
    const g = await grabadora.terminar();
    const pregunta = actual.current.pregunta;
    const vacia: EventoManosLibres = pregunta === "pago" ? { tipo: "pago", pago: "fallo" } : { tipo: "respuesta", respuesta: "fallo" };
    // La venta viaja solo si esta tarjeta sabe corregirse hablando (la venta): sin ella, el servidor no intenta corregir.
    const venta = corregir.current && actualDeLaTarjeta.current ? actualDeLaTarjeta.current() : null;
    const r = g.audio.size === 0 ? { ev: vacia } : await entender(g.audio, g.duracionMs, pregunta, venta);
    if (mio !== turno.current) return;
    corregida.current = r.corregida ?? null;
    aplicar(r.ev);
  }

  function ejecutar(efecto: EfectoManosLibres, ev: EventoManosLibres) {
    switch (efecto) {
      case "repreguntar":
        return decir(actual.current.pregunta === "pago" ? REPREGUNTA_PAGO : REPREGUNTA);
      case "anotar": {
        if (ev.tipo !== "pago" || ev.pago === null || ev.pago === "fallo") return;
        relectura.current = anotar.current?.(ev.pago) ?? null;
        return aplicar({ tipo: "anotado", lista: relectura.current !== null });
      }
      case "corregir": {
        // Sin alCorregir no se envía la venta, así que no debería pasar; si pasa, se calla y queda para tocar (nunca trabado).
        if (!corregida.current || !corregir.current) return aplicar({ tipo: "tocaron" });
        const g = corregir.current(corregida.current);
        corregida.current = null;
        relectura.current = { texto: g.texto, entera: g.entera };
        return aplicar({ tipo: "corregida", pregunta: g.pregunta });
      }
      case "repetir": // lo que se leyó, entero: la venta, o la pregunta de si pagó
        return leido.current ? decir(leido.current) : aplicar({ tipo: "tocaron" });
      case "releer":
        if (!relectura.current) return;
        leido.current = relectura.current.entera;
        return decir(relectura.current.texto);
      case "escuchar":
        return void escuchar();
      case "enviar":
        return void enviar();
      case "descartar":
        limpiarRelojes();
        turno.current++;
        return void grabadora.terminar();
      case "confirmar":
        return confirmar.current();
      case "callar":
        limpiarRelojes();
        turno.current++;
        callar();
        return void grabadora.terminar();
      case "nada":
        return;
    }
  }

  /** Se cerró la tarjeta: se calla lo que se estuviera leyendo y nada de lo pendiente cuenta (el micrófono lo apaga la grabadora). */
  function soltar() {
    turno.current++;
    limpiarRelojes();
    if (actual.current.fase === "leyendo") callar();
  }

  // El guion se dice apenas se abre la tarjeta. En desarrollo React monta dos veces: el turno deja sin efecto la primera.
  useEffect(() => {
    if (!guion) return;
    decir(guion.texto);
    return soltar;
    // Solo al abrir la tarjeta: `decir` cambia en cada render pero lee todo de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion]);

  useEffect(() => {
    if (guardado && guion) hablar(GUARDADO);
  }, [guardado, guion]);

  return {
    fase: estado.fase,
    nota: notaManosLibres(estado, { corrige: alCorregir !== undefined }),
    tomarControl: () => aplicar({ tipo: "tocaron" }),
  };
}
