// Cuándo el puntaje de «Hola Fructus» (lib/voz/detector-palabra.ts) cuenta como «despertó». Lógica pura: es la misma regla con que
// se midió el modelo (`activaciones` en scripts/voz/palabra-activacion/medir.py), así lo medido vale para la app.
//
// Con el modelo provisional, umbral 0.9 y 3 cuadros seguidos: 90 % de detección sin ruido y 1.04 falsas por hora con ruido
// (docs/voz/palabra-activacion-2026-11-14-provisional.md). Pedir varios cuadros seguidos es lo que más baja las falsas: un golpe o
// una palabra suelta pasan el umbral en un cuadro, la frase entera lo sostiene.

/** El puntaje que hay que pasar en cada cuadro. */
export const UMBRAL = 0.9;
/** Cuántos cuadros de 80 ms seguidos sobre el umbral hacen falta (240 ms). */
export const CUADROS_SEGUIDOS = 3;
/** Después de despertar, 2 s (25 cuadros de 80 ms) sin volver a despertar: la misma frase no despierta dos veces. */
export const CUADROS_DE_ESPERA = 25;

export type Atencion = {
  /** Cuadros seguidos sobre el umbral hasta ahora. */
  seguidos: number;
  /** Cuadros que faltan para volver a escuchar después de despertar. */
  espera: number;
};

export const ATENCION_NUEVA: Atencion = { seguidos: 0, espera: 0 };

/** Un puntaje más. `desperto`: es el cuadro en que se completó la frase. */
export function atender(a: Atencion, puntaje: number): { atencion: Atencion; desperto: boolean } {
  if (a.espera > 0) return { atencion: { seguidos: 0, espera: a.espera - 1 }, desperto: false };
  const seguidos = puntaje >= UMBRAL ? a.seguidos + 1 : 0;
  if (seguidos >= CUADROS_SEGUIDOS) return { atencion: { seguidos: 0, espera: CUADROS_DE_ESPERA }, desperto: true };
  return { atencion: { seguidos, espera: 0 }, desperto: false };
}
