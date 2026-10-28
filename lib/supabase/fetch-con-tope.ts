// Toda llamada externa lleva un tope de espera (CLAUDE.md, «La voz» y principio 8).
// Si Supabase no responde en 8 s, la llamada falla con un error que se puede mostrar,
// en vez de dejar la pantalla colgada.
const TOPE_MS = 8_000;

export const fetchWithTimeout: typeof fetch = (entrada, opciones) => {
  const tope = AbortSignal.timeout(TOPE_MS);
  const signal = opciones?.signal ? AbortSignal.any([opciones.signal, tope]) : tope;
  return fetch(entrada, { ...opciones, signal });
};
