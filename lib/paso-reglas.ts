// Mantener apretado «+» o «−» sigue sumando, como en el reloj o la calculadora del celular: espera un momento (para no confundirlo con un
// toque) y después repite, cada vez más rápido. Lógica pura.

/** Cuánto esperar (ms) antes del paso número `n` que se da manteniendo apretado (el 0 es el primero después del toque). */
export function esperaDelPaso(n: number): number {
  if (n <= 0) return 450;
  if (n < 6) return 120;
  return 60;
}
