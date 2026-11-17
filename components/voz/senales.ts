// Tacto y sonido al guardar (CLAUDE.md, regla 8): la persona sabe que se guardó sin mirar. Solo navegador.

/** Un tono corto con el sintetizador del navegador (no descarga ningún archivo): `notas` en Hz, una tras otra cada `paso` s. */
function sonar(notas: number[], paso: number, volumen: number, que: string) {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    const t = ac.currentTime;
    const fin = paso * notas.length + 0.19;
    o.type = "sine";
    notas.forEach((n, i) => o.frequency.setValueAtTime(n, t + i * paso));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + fin - 0.02);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + fin);
    o.onended = () => void ac.close();
  } catch (e) {
    // Sin sonido queda la vibración y lo que se ve: no se interrumpe nada.
    console.warn(`voz: sin sonido de ${que}`, { error: e instanceof Error ? e.name : "desconocido" });
  }
}

/** Un «tin-tín» al guardar. */
export const sonarGuardado = () => sonar([660, 990], 0.09, 0.18, "confirmación");

/** Un «tin» suave y agudo al oír «Hola Fructus»: ya se puede hablar. Distinto del de guardar, para no confundirlos sin mirar. */
export const sonarEscucho = () => sonar([1046], 0.05, 0.12, "escucha");

export function vibrar(ms: number) {
  navigator.vibrate?.(ms);
}
