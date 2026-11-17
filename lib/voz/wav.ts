// Un WAV mono de 16 bits: el formato más simple que acepta Whisper. Lo arma el celular con lo que oyó después de «Hola Fructus»
// (components/voz/escucha.worker.ts), con los 2 s de antes incluidos. Sin comprimir pesa unos 32 KB por segundo, pero Whisper oye
// exactamente lo que oyó el detector: a 16 kHz, que es como Whisper procesa todo audio. Lógica pura.

const CABECERA = 44;

/** El WAV de estas muestras de 16 bits, a esta frecuencia. */
export function wavDe(muestras: Int16Array, frecuencia: number): ArrayBuffer {
  const bytes = muestras.length * 2;
  const wav = new ArrayBuffer(CABECERA + bytes);
  const v = new DataView(wav);
  const texto = (en: number, t: string) => [...t].forEach((c, i) => v.setUint8(en + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  v.setUint32(4, CABECERA - 8 + bytes, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true); // largo del bloque fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true); // bits por muestra
  texto(36, "data");
  v.setUint32(40, bytes, true);
  muestras.forEach((m, i) => v.setInt16(CABECERA + i * 2, m, true));
  return wav;
}

/** Las muestras y la frecuencia de un WAV mono de 16 bits (el que arma wavDe, o uno de prueba). Error si es otra cosa. */
export function leerWav(wav: ArrayBuffer): { muestras: Int16Array; frecuencia: number } {
  const v = new DataView(wav);
  const texto = (en: number) => String.fromCharCode(v.getUint8(en), v.getUint8(en + 1), v.getUint8(en + 2), v.getUint8(en + 3));
  if (wav.byteLength < 12 || texto(0) !== "RIFF" || texto(8) !== "WAVE") throw new Error("no es un WAV");
  let frecuencia = 0;
  for (let i = 12; i + 8 <= wav.byteLength; ) {
    const largo = v.getUint32(i + 4, true);
    if (texto(i) === "fmt ") {
      if (v.getUint16(i + 8, true) !== 1 || v.getUint16(i + 10, true) !== 1 || v.getUint16(i + 22, true) !== 16) throw new Error("el WAV no es PCM mono de 16 bits");
      frecuencia = v.getUint32(i + 12, true);
    }
    if (texto(i) === "data") {
      const muestras = new Int16Array(Math.floor(Math.min(largo, wav.byteLength - i - 8) / 2));
      muestras.forEach((_, k) => (muestras[k] = v.getInt16(i + 8 + k * 2, true)));
      if (!frecuencia) throw new Error("el WAV no dice su frecuencia");
      return { muestras, frecuencia };
    }
    i += 8 + largo + (largo % 2);
  }
  throw new Error("el WAV no trae audio");
}
