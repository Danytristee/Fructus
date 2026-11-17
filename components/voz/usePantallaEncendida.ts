"use client";

import { useEffect } from "react";

/**
 * Mientras `activa`, la pantalla no se apaga sola (Screen Wake Lock). «Hola Fructus» solo escucha con la pantalla a la vista (ADR-0022):
 * si el celular la apagaba al minuto, el dueño decía «Hola Fructus» y nadie lo oía. El navegador suelta el pedido cuando la pantalla se
 * oculta (otra app, el botón de bloqueo); al volver se pide otra vez. Donde no existe (o el ahorro de batería lo niega), la pantalla se
 * apaga como siempre: no es una falla.
 */
export function usePantallaEncendida(activa: boolean) {
  useEffect(() => {
    if (!activa || !("wakeLock" in navigator)) return;
    let pedido: WakeLockSentinel | null = null;
    let vigente = true;

    async function pedir() {
      if (document.visibilityState !== "visible" || (pedido && !pedido.released)) return;
      try {
        const nuevo = await navigator.wakeLock.request("screen");
        if (vigente) pedido = nuevo;
        else void nuevo.release();
      } catch (e) {
        // Ahorro de batería o sin permiso: la pantalla se apagará sola. Se deja dicho, sin datos de nadie.
        console.warn("pantalla: no se pudo dejar encendida", { motivo: e instanceof DOMException ? e.name : "desconocido" });
      }
    }

    const alCambiar = () => void pedir();
    void pedir();
    document.addEventListener("visibilitychange", alCambiar);
    return () => {
      vigente = false;
      document.removeEventListener("visibilitychange", alCambiar);
      void pedido?.release();
    };
  }, [activa]);
}
