// Tacto y sonido al guardar (CLAUDE.md, regla 8): la persona sabe que se guardó sin mirar. Solo navegador.

/** Un «tin-tín» corto, hecho con el sintetizador del navegador: no descarga ningún archivo. */
export function sonarGuardado() {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    const t = ac.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(990, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.3);
    o.onended = () => void ac.close();
  } catch (e) {
    // Sin sonido queda la vibración y el sello: no se interrumpe nada.
    console.warn("voz: sin sonido de confirmación", { error: e instanceof Error ? e.name : "desconocido" });
  }
}

export function vibrar(ms: number) {
  navigator.vibrate?.(ms);
}
