// La escucha de «Hola Fructus» en «Hoy» (actividad 5c). Lógica pura: cuándo se escucha, qué se guarda de lo oído antes de despertar
// y cuándo terminó el dictado que siguió. El audio y el detector viven en components/voz/escucha.worker.ts; el micrófono, en
// components/voz/useHolaFructus.ts.

import { FRECUENCIA, MUESTRAS_POR_CUADRO } from "./detector-palabra";
import { crearFinDeHabla, type FinDeHabla } from "./fin-de-habla";
import { VOZ_MINIMA_MS } from "./silencio-reglas";

/**
 * Cómo está la escucha:
 * - apagada: el interruptor está apagado. Sin micrófono ni modelos.
 * - dormida: la pantalla no se ve (otra app, el celular bloqueado). Se suelta el micrófono; los modelos quedan cargados.
 * - pausada: el micrófono sigue abierto pero no se busca la frase (hay una tarjeta abierta, se graba con el dedo, se entiende).
 * - atenta: busca «Hola Fructus», o graba lo que se dijo después de despertar.
 */
export type EstadoEscucha = "apagada" | "dormida" | "pausada" | "atenta";

export function estadoDeEscucha(o: {
  /** El interruptor «Hola Fructus» de este celular. */
  activa: boolean;
  visible: boolean;
  hojaAbierta: boolean;
  voz: "listo" | "escuchando" | "entendiendo";
  /** Lo que se está escuchando empezó con «Hola Fructus» (y no con el dedo). */
  porPalabra: boolean;
}): EstadoEscucha {
  if (!o.activa) return "apagada";
  if (!o.visible) return "dormida";
  // Con la tarjeta abierta no se busca la frase: mientras Fructus lee la venta, no se oye a sí mismo, y un «Hola Fructus» del cliente
  // no abre otra encima.
  if (o.hojaAbierta || o.voz === "entendiendo") return "pausada";
  // Grabando con el dedo, el micrófono es de esa grabación: decir «Hola Fructus» en medio de lo dictado no despierta nada.
  if (o.voz === "escuchando" && !o.porPalabra) return "pausada";
  return "atenta";
}

/** Lo que se guarda de antes de despertar: la frase entera (para que Whisper confirme que se dijo, actividad 5d) y lo que siguió. */
const PREVIO_MS = 2000;
export const CUADROS_PREVIOS = PREVIO_MS / ((MUESTRAS_POR_CUADRO / FRECUENCIA) * 1000);
/** Después de despertar, si no habla en este tiempo, no era para Fructus: se descarta y se vuelve a escuchar. */
export const ESPERA_VOZ_MS = 5000;
/**
 * Lo primero que se oye después de despertar es casi siempre el final de la frase: el detector despierta a mitad de «…tus» (pide 3
 * cuadros seguidos sobre el umbral) y la frase sigue unos 300 a 400 ms más. Eso se graba, pero no cuenta como voz ni como silencio:
 * si contara, decir «Hola Fructus» y esperar 1.2 s enviaba la frase sola y se perdía la orden que venía.
 */
const COLA_DE_LA_FRASE_MS = 500;
const MS_POR_CUADRO = (MUESTRAS_POR_CUADRO / FRECUENCIA) * 1000;

/** Lo que va quedando de un dictado que empezó con «Hola Fructus». */
export type Dictado = {
  /** El audio, en cuadros de 80 ms: primero los de antes de despertar, después lo que siguió. */
  cuadros: Int16Array[];
  /** El que decide cuándo se calló: Silero si ya está, si no el volumen (lib/voz/fin-de-habla.ts). Oye lo que sigue a la frase. */
  oido: FinDeHabla;
  hablo: boolean;
  /** Cuánto pasó desde que despertó. */
  ms: number;
};

/** Un dictado nuevo con lo de antes de despertar. `oido`: uno nuevo para este dictado (el worker le da Silero si lo tiene). */
export function empezarDictado(previos: readonly Int16Array[], oido: FinDeHabla = crearFinDeHabla()): Dictado {
  return { cuadros: [...previos], oido, hablo: false, ms: 0 };
}

/** Guarda un cuadro para el WAV sin oírlo: lo que quedaba en la cola cuando se cierra el dictado. */
export function guardarCuadro(d: Dictado, cuadro: Int16Array): Dictado {
  return { ...d, cuadros: [...d.cuadros, cuadro], ms: d.ms + MS_POR_CUADRO };
}

/**
 * Un cuadro más del dictado. `callo`: habló y después calló (el mismo oído que sin el dedo). `mudo`: pasaron ESPERA_VOZ_MS sin que
 * hablara. Lo de antes de despertar no se oye: si contara, callarse justo después de «Hola Fructus» (esperando que el celular
 * responda) enviaría la frase sola. Por lo mismo, «habló» pide la voz mínima del silencio (VOZ_MINIMA_MS): el final de «…tus» suele
 * caer justo después de despertar, y con contar eso, nunca era «mudo». `fallo`: Silero se cayó y sigue el volumen.
 */
export async function seguirDictado(d: Dictado, cuadro: Int16Array): Promise<{ dictado: Dictado; callo: boolean; mudo: boolean; fallo?: string }> {
  const guardado = guardarCuadro(d, cuadro);
  if (d.ms < COLA_DE_LA_FRASE_MS) return { dictado: guardado, callo: false, mudo: false };
  const aviso = await d.oido.oir(Float32Array.from(cuadro, (m) => m / 32768));
  const hablo = d.hablo || aviso.vozMs >= VOZ_MINIMA_MS;
  const r = { dictado: { ...guardado, hablo }, callo: aviso.callo, mudo: !hablo && guardado.ms >= ESPERA_VOZ_MS };
  return aviso.fallo ? { ...r, fallo: aviso.fallo } : r;
}

/** Todo el audio del dictado, en orden, para armar el WAV. */
export function muestrasDe(d: Dictado): Int16Array {
  const todas = new Int16Array(d.cuadros.reduce((n, c) => n + c.length, 0));
  let en = 0;
  for (const c of d.cuadros) {
    todas.set(c, en);
    en += c.length;
  }
  return todas;
}
