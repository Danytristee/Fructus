// Cómo responde la hoja al dedo, como en un celular: la hoja sigue al dedo, se resiste si la suben más de la cuenta y, al soltarla, decide
// si se va o vuelve según cuánto bajó y qué tan rápido iba. Lógica pura: el componente solo mide y aplica.

export type Muestra = { y: number; t: number };

/** Píxeles por milisegundo. Un dedo que «tira» la hoja hacia abajo va a 0.4 o más (el mismo umbral que las hojas nativas). */
const VELOCIDAD_TIRON = 0.4;
/** Si el dedo ya subía al soltar, la hoja vuelve aunque esté bastante abajo: la persona se arrepintió. */
const VELOCIDAD_ARREPENTIDO = -0.2;
/** Cuánto «viaja» la hoja después de soltarla (ms), para proyectar dónde quedaría con el impulso. */
const PROYECCION_MS = 150;

/**
 * Hacia arriba la hoja no tiene adónde ir: se estira poco y cada vez menos (la misma curva que iOS para los bordes).
 * `dy` es negativo hacia arriba; hacia abajo no hay resistencia.
 */
export function resistencia(dy: number, dimension: number): number {
  if (dy >= 0) return dy;
  const d = Math.max(dimension, 1);
  return -(1 - 1 / ((-dy * 0.55) / d + 1)) * d;
}

/** La velocidad del dedo en los últimos ~80 ms (px/ms, positiva hacia abajo). Con una sola muestra, 0. */
export function velocidadDe(muestras: Muestra[], ventanaMs = 80): number {
  const ultima = muestras.at(-1);
  if (!ultima || muestras.length < 2) return 0;
  let primera = ultima;
  for (let i = muestras.length - 2; i >= 0; i--) {
    const m = muestras[i]!;
    if (ultima.t - m.t > ventanaMs && primera !== ultima) break;
    primera = m;
  }
  const dt = ultima.t - primera.t;
  return dt > 0 ? (ultima.y - primera.y) / dt : 0;
}

/** Desde cuántos píxeles abajo se cierra al soltarla despacio: un tercio de la hoja, entre 56 y 240 px. */
export function umbralCierre(alto: number): number {
  return Math.min(Math.max(alto * 0.33, 56), 240);
}

/** Al soltar: ¿la hoja se va o vuelve a su sitio? */
export function decidirSoltar({ desplazamiento, alto, velocidad }: { desplazamiento: number; alto: number; velocidad: number }): "cerrar" | "volver" {
  if (desplazamiento <= 0) return "volver";
  if (velocidad <= VELOCIDAD_ARREPENTIDO) return "volver";
  if (velocidad >= VELOCIDAD_TIRON && desplazamiento > 12) return "cerrar";
  const proyectado = desplazamiento + Math.max(velocidad, 0) * PROYECCION_MS;
  return proyectado >= umbralCierre(alto) ? "cerrar" : "volver";
}

/** Cuánto dura la bajada final: si el dedo la tiró rápido, la hoja sigue a esa velocidad (sin frenar de golpe); si no, el tiempo de siempre. */
export function duracionCierre({ desplazamiento, alto, velocidad }: { desplazamiento: number; alto: number; velocidad: number }): number {
  const restante = Math.max(alto * 1.05 - desplazamiento, 0);
  if (velocidad < 0.3) return 280;
  return Math.round(Math.min(Math.max(restante / velocidad, 140), 300));
}

/**
 * Los primeros píxeles deciden qué quiere el dedo: si se mueve más de lado que hacia abajo, no es para la hoja (deja pasar un carrusel o
 * una selección). Mientras no se movió lo suficiente, todavía no se sabe.
 */
export function ejeDelGesto(dx: number, dy: number, umbral = 6): "vertical" | "horizontal" | null {
  if (Math.abs(dx) < umbral && Math.abs(dy) < umbral) return null;
  return Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
}

/** Lo oscuro de atrás se aclara a medida que la hoja baja: a media hoja ya casi no se ve. */
export function opacidadVelo(desplazamiento: number, alto: number): number {
  if (desplazamiento <= 0) return 1;
  return Math.max(0, 1 - desplazamiento / Math.max(alto, 1));
}
