"use client";

import { useEffect, useRef } from "react";

import { LIBRE, MANTENER_MS, siguienteToque, type EventoToque } from "@/lib/voz/toque-reglas";

/**
 * Las manos sobre una tarjeta de voz con manos libres: tocarla calla la voz (ADR-0020), deslizarla para leer, no
 * (lib/voz/toque-reglas.ts). Devuelve los manejadores para el contenedor de la tarjeta; con la voz ya callada (`activo` falso), ninguno.
 */
export function useToqueTarjeta(activo: boolean, alTocar: () => void) {
  const toque = useRef(LIBRE);
  const reloj = useRef<number | null>(null);
  const tocar = useRef(alTocar);
  useEffect(() => {
    tocar.current = alTocar;
  });

  function limpiar() {
    if (reloj.current !== null) window.clearTimeout(reloj.current);
    reloj.current = null;
  }
  useEffect(() => limpiar, []);

  function aplicar(e: EventoToque) {
    const r = siguienteToque(toque.current, e);
    toque.current = r.toque;
    if (r.toque.fase === "libre") limpiar();
    if (r.calla) tocar.current();
  }

  if (!activo) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      aplicar({ tipo: "bajar", x: e.clientX, y: e.clientY });
      limpiar();
      reloj.current = window.setTimeout(() => aplicar({ tipo: "quieto" }), MANTENER_MS);
    },
    onPointerMove: (e: React.PointerEvent) => e.isPrimary && aplicar({ tipo: "mover", x: e.clientX, y: e.clientY }),
    onPointerUp: () => aplicar({ tipo: "soltar" }),
    onPointerCancel: () => aplicar({ tipo: "perder" }),
    // En captura: calla antes de que el botón tocado haga lo suyo (abrir el editor, cambiar «Pagó / Lo debe»).
    onClickCapture: () => aplicar({ tipo: "clic" }),
  };
}
