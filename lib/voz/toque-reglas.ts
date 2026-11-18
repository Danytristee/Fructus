// Tocar la tarjeta calla la voz (ADR-0020); deslizarla para leer, no. Un dedo que baja puede ser cualquiera de las dos cosas, y se
// sabe después: si se mueve, desliza; si se suelta quieto, tocó (lo dice el clic que sigue); si se queda quieto un rato, toca a
// propósito, como al mantener «+» en el conteo. Antes se callaba al bajar el dedo, y leer deslizando cortaba la lectura o la escucha
// (/formidable 2026-11-18). Lógica pura: no importa React. Quien la usa calla la voz cuando devuelve `calla`.

import { esperaDelPaso } from "../paso-reglas";

/** Hasta esto (px) se mueve un dedo que toca; más, ya desliza. */
export const TOLERANCIA_PX = 10;
/** Un dedo quieto tanto tiempo toca a propósito: lo mismo que espera «+» antes de repetir (lib/paso-reglas.ts). */
export const MANTENER_MS = esperaDelPaso(0);

export type Toque = { fase: "libre" } | { fase: "abajo"; x: number; y: number };

export type EventoToque =
  | { tipo: "bajar"; x: number; y: number }
  | { tipo: "mover"; x: number; y: number }
  /** Pasó MANTENER_MS con el dedo abajo. */
  | { tipo: "quieto" }
  | { tipo: "soltar" }
  /** pointercancel: el navegador se quedó con el gesto para deslizar la hoja. */
  | { tipo: "perder" }
  /** Un toque terminado, o Enter o Espacio con el teclado. Deslizar no termina en clic. */
  | { tipo: "clic" };

export const LIBRE: Toque = { fase: "libre" };

export function siguienteToque(t: Toque, e: EventoToque): { toque: Toque; calla: boolean } {
  switch (e.tipo) {
    case "bajar":
      return { toque: { fase: "abajo", x: e.x, y: e.y }, calla: false };
    case "mover":
      if (t.fase === "abajo" && Math.hypot(e.x - t.x, e.y - t.y) > TOLERANCIA_PX) return { toque: LIBRE, calla: false };
      return { toque: t, calla: false };
    case "quieto":
      return { toque: LIBRE, calla: t.fase === "abajo" };
    case "soltar":
    case "perder":
      return { toque: LIBRE, calla: false };
    case "clic":
      return { toque: LIBRE, calla: true };
  }
}
