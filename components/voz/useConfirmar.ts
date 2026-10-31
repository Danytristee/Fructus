"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useEspera } from "@/components/ui/Espera";
import { sonarGuardado, vibrar } from "./senales";

type Fallo = { ok: false; error: string; sinSesion?: true };

// Toda llamada lleva tope (CLAUDE.md, «La voz»). Sin él, con la red colgada, «Guardando…» no terminaba nunca (/chaos).
const TOPE_CONFIRMAR_MS = 15_000;
const SIN_RESPUESTA = "La señal no respondió y no sé si se guardó. Toca Confirmar otra vez: no se va a repetir.";

type Opciones = {
  /** La base respondió que se guardó (la hoja muestra el sello y se cierra sola). */
  alGuardar: () => void;
  /** Mientras guarda, la hoja no se cierra ni se descarta: la pantalla no puede decir «no guardé» de algo que se guardó. */
  alCambiarGuardando: (guardando: boolean) => void;
};

/**
 * Confirmar, igual en todas las tarjetas de voz (una función, una pieza): un solo envío a la vez, tope de 15 s, el
 * indicador de carga del layout, el error en lenguaje de puesto, y al guardar, vibración, sonido y «Hoy» refrescado por
 * detrás. Nada optimista: el éxito se muestra solo cuando la base respondió. Un segundo toque no duplica porque cada
 * acción es idempotente por comando, así que tras un error se puede volver a tocar.
 */
export function useConfirmar<R extends { ok: true }>({ alGuardar, alCambiarGuardando }: Opciones) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; sinSesion: boolean } | null>(null);
  const [guardado, setGuardado] = useState<R | null>(null);
  const enviando = useRef(false);
  /** El último Confirmar no tuvo respuesta: pudo haberse guardado y el aviso al descartar no puede decir «no guardé». */
  const incierto = useRef(false);
  const esperar = useEspera();
  const router = useRouter();

  async function confirmar(guardar: () => Promise<R | Fallo>) {
    if (enviando.current) return;
    enviando.current = true;
    setGuardando(true);
    alCambiarGuardando(true);
    setError(null);
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

  return { confirmar, guardando, error, guardado, incierto };
}
