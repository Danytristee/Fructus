"use client";

import { useEffect } from "react";

// Safari en iPhone ignora `user-scalable=no` desde iOS 10 (por accesibilidad) y amplía con el pellizco aunque el viewport lo prohíba. Su
// único freno es cancelar los eventos de gesto, que solo existen en Safari. En los demás navegadores esto no hace nada.
// No dibuja nada.
export function PantallaFija() {
  useEffect(() => {
    const frenar = (e: Event) => e.preventDefault();
    const eventos = ["gesturestart", "gesturechange", "gestureend"] as const;
    for (const evento of eventos) document.addEventListener(evento, frenar, { passive: false });
    return () => {
      for (const evento of eventos) document.removeEventListener(evento, frenar);
    };
  }, []);
  return null;
}
