import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { leerWav, wavDe } from "./wav";

describe("el WAV que se envía a Whisper", () => {
  test("lleva la cabecera de PCM mono de 16 bits y las muestras en orden", () => {
    const muestras = Int16Array.of(0, 1, -1, 32767, -32768);
    const wav = wavDe(muestras, 16_000);
    const v = new DataView(wav);
    expect(wav.byteLength).toBe(44 + 10);
    expect(String.fromCharCode(...new Uint8Array(wav, 0, 4))).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 10);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000); // 32 KB por segundo
    expect(v.getUint32(40, true)).toBe(10);
    expect(leerWav(wav)).toEqual({ muestras, frecuencia: 16_000 });
  });

  test("lee los audios de prueba, que escribió Python", () => {
    const b = readFileSync("tests/palabra/hola-fructus.wav");
    const { muestras, frecuencia } = leerWav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(frecuencia).toBe(16_000);
    expect(muestras.length % 1280).toBe(0);
    expect(Math.max(...muestras.map(Math.abs))).toBeGreaterThan(10_000); // tiene voz, no solo silencio
  });

  test("otra cosa no es un WAV", () => {
    expect(() => leerWav(new TextEncoder().encode("hola, no soy un audio").buffer)).toThrow(/no es un WAV/);
  });
});
