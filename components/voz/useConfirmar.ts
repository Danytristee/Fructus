"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCola } from "@/components/cola/ColaProveedor";
import { useEspera } from "@/components/ui/Espera";
import { resumenDe, sinComando, SIN_SENAL, type Operacion } from "@/lib/cola-reglas";
import { sonarGuardado, vibrar } from "./senales";

type Fallo = { ok: false; error: string; sinSesion?: true };

// Toda llamada lleva tope (CLAUDE.md, «La voz»). Sin él, con la red colgada, «Guardando…» no terminaba nunca (/chaos).
const TOPE_CONFIRMAR_MS = 15_000;
// Dice el nombre del botón que la persona ve: «Confirmar» en las tarjetas, «Guardar cliente» o «Anular la venta» en otras hojas.
const sinRespuesta = (boton: string) => `La señal no respondió y no sé si se guardó. Toca ${boton} otra vez: no se va a repetir.`;
// Lo que no se puede guardar en el celular (anular, emitir, guardar un cliente) necesita señal en el momento.
const NECESITA_SENAL = "Sin señal: esto necesita señal para guardarse. Inténtalo cuando vuelva.";
const NO_SE_GUARDO_EN_EL_CELULAR = "Sin señal, y el celular no pudo guardarlo. Inténtalo cuando vuelva la señal.";

type Opciones = {
  /** La base respondió que se guardó (la hoja muestra el sello y se cierra sola). */
  alGuardar: () => void;
  /** Mientras guarda, la hoja no se cierra ni se descarta: la pantalla no puede decir «no guardé» de algo que se guardó. */
  alCambiarGuardando: (guardando: boolean) => void;
  /** Cómo se llama el botón que guarda, para el aviso de «la señal no respondió». Por defecto, «Confirmar». */
  boton?: string;
};

/**
 * Confirmar, igual en todas las tarjetas de voz (una función, una pieza): un solo envío a la vez, tope de 15 s, el
 * indicador de carga del layout, el error en lenguaje de puesto, y al guardar, vibración, sonido y «Hoy» refrescado por
 * detrás. Nada optimista: el éxito se muestra solo cuando la base respondió. Un segundo toque no duplica porque cada
 * acción es idempotente por comando, así que tras un error se puede volver a tocar.
 */
export function useConfirmar<R extends { ok: true }>({ alGuardar, alCambiarGuardando, boton = "Confirmar" }: Opciones) {
  const SIN_RESPUESTA = sinRespuesta(boton);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; sinSesion: boolean } | null>(null);
  const [guardado, setGuardado] = useState<R | null>(null);
  /** Quedó guardado en el celular, no en la base: se envía solo cuando vuelva la señal (ADR-0017). No es un éxito. */
  const [encolado, setEncolado] = useState(false);
  const cola = useCola();
  const enviando = useRef(false);
  /** El último Confirmar no tuvo respuesta: pudo haberse guardado y el aviso al descartar no puede decir «no guardé». */
  const incierto = useRef(false);
  const esperar = useEspera();
  const router = useRouter();

  /** Lo guarda en la cola del celular y la hoja lo dice. false si el celular no pudo. */
  async function aLaCola(op: Operacion): Promise<boolean> {
    if (!cola || !(await cola.encolar({ clase: "confirmacion", operacion: op }, resumenDe(op)))) return false;
    setEncolado(true);
    vibrar(30); // sin el «tin-tín»: ese es solo para lo que la base ya guardó
    alGuardar();
    return true;
  }

  /**
   * `encolable`: los datos de lo que se guarda, para la cola sin conexión. Con él, sin señal (o si la señal no respondió)
   * se guarda en el celular y se envía solo después; reenviarlo no duplica porque cada acción es idempotente por comando.
   * Sin él (anular, emitir, un cliente), sin señal se dice que hace falta señal.
   */
  async function confirmar(guardar: () => Promise<R | Fallo>, encolable?: Operacion) {
    if (enviando.current) return;
    enviando.current = true;
    setError(null);
    const sinSenal = typeof navigator !== "undefined" && !navigator.onLine;
    // Sin señal, o una tarjeta «a mano» abierta sin señal (todavía sin comando): directo al celular, sin esperar.
    if (encolable && (sinSenal || sinComando(encolable.entrada.comandoId))) {
      if (await aLaCola(encolable)) return;
      enviando.current = false;
      setError({ mensaje: NO_SE_GUARDO_EN_EL_CELULAR, sinSesion: false });
      return;
    }
    if (sinSenal) {
      enviando.current = false;
      setError({ mensaje: NECESITA_SENAL, sinSesion: false });
      return;
    }
    setGuardando(true);
    alCambiarGuardando(true);
    let reloj = 0;
    const tope = new Promise<Fallo>((resolve) => {
      reloj = window.setTimeout(() => resolve({ ok: false, error: SIN_RESPUESTA }), TOPE_CONFIRMAR_MS);
    });
    // Si la acción falla por red, no se sabe si llegó: pudo guardarse y perderse la respuesta. Decir «no se pudo guardar»
    // llevaba a dictarlo otra vez, y eso es otro comando: el abono se registraba dos veces (/chaos 2026-10-31).
    const r = await esperar(Promise.race([guardar().catch((): Fallo => ({ ok: false, error: SIN_RESPUESTA })), tope]));
    window.clearTimeout(reloj);
    setGuardando(false);
    alCambiarGuardando(false);
    // La señal no respondió (o la base no contestó): se guarda en el celular y se reintenta solo, en vez de pedir otro toque.
    if (!r.ok && encolable && (r.error === SIN_RESPUESTA || r.error === SIN_SENAL) && (await aLaCola(encolable))) return;
    if (!r.ok) {
      enviando.current = false;
      incierto.current = r.error === SIN_RESPUESTA;
      setError({ mensaje: r.error, sinSesion: r.sinSesion === true });
      return;
    }
    setGuardado(r);
    vibrar(30);
    sonarGuardado();
    alGuardar();
    // «Hoy» (lo vendido, lo último, la deuda) se rearma por detrás mientras el sello se anima.
    startTransition(() => router.refresh());
  }

  /**
   * Deja el botón listo para otra operación. Tras un éxito el hook se cierra a nuevos envíos (un segundo toque no duplica lo
   * guardado); este es solo para una pantalla cuyo éxito no termina el trabajo, como emitir un comprobante que queda «en proceso»
   * y todavía hay que reintentar. Se llama desde adentro de `guardar`, cuando el resultado deja algo por hacer.
   */
  function reiniciar() {
    enviando.current = false;
    incierto.current = false;
    setGuardado(null);
    setEncolado(false);
    setError(null);
  }

  return { confirmar, guardando, error, guardado, encolado, incierto, reiniciar };
}
