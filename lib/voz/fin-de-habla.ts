// Cuándo terminó de hablar, sobre el audio crudo del micrófono a 16 kHz. Junta lo que llega en cuadros de 50 ms y se los pasa a
// lib/voz/silencio-reglas.ts: con lo que dice Silero (lib/voz/detector-voz.ts) si ya está, y con el volumen solo mientras tanto, o si
// no pudo cargar. Cuando Silero llega, vuelve a oír con él desde el principio: lo dicho mientras bajaba el modelo cuenta igual.
//
// La usan los workers que escuchan (components/voz/oido.worker.ts al grabar con el toque, components/voz/escucha.worker.ts después de
// «Hola Fructus»). No sabe de micrófonos ni de ONNX.

import { MUESTRAS_POR_VENTANA, type DetectorVoz } from "./detector-voz";
import { CUADRO_MS, OIDO_NUEVO, SILENCIO_PARA_ENVIAR_MS, nivelDb, oir, type Oido } from "./silencio-reglas";

const FRECUENCIA = 16_000;
/** Un cuadro de 50 ms a 16 kHz. */
const MUESTRAS_POR_CUADRO = (FRECUENCIA * CUADRO_MS) / 1000;

/**
 * Lo que dijo Silero del cuadro `k` (50 ms): lo más alto de sus ventanas de 32 ms que terminan dentro del cuadro. Como el cuadro es más
 * largo que la ventana, siempre hay al menos una. null si todavía no se oyeron todas.
 */
export function sileroDelCuadro(ventanas: readonly number[], k: number): number | null {
  const desde = Math.floor((MUESTRAS_POR_CUADRO * k) / MUESTRAS_POR_VENTANA);
  const hasta = Math.floor((MUESTRAS_POR_CUADRO * (k + 1)) / MUESTRAS_POR_VENTANA) - 1;
  if (hasta >= ventanas.length) return null;
  let mayor = 0;
  for (let m = desde; m <= hasta; m++) mayor = Math.max(mayor, ventanas[m]!);
  return mayor;
}

/**
 * `callo`: habló y después calló (o llegó al tope). `hablo`: ya dijo algo. `vozMs`: lo más que llegó a sumar de voz en lo oído ahora
 * (para quien pide más que un sonido suelto, como «Hola Fructus»). `fallo`: Silero falló y se sigue con el volumen.
 */
export type Aviso = { callo: boolean; hablo: boolean; vozMs: number; fallo?: string };

export type FinDeHabla = {
  /** Muestras nuevas del micrófono (de -1 a 1, a 16 kHz, de cualquier largo), en orden. */
  oir: (muestras: Float32Array) => Promise<Aviso>;
  /** Llegó Silero: desde ahora decide él, y vuelve a oír desde el principio. Un detector nuevo por cada vez que se escucha. */
  conSilero: (detector: DetectorVoz) => Promise<Aviso>;
};

/** Una escucha nueva: desde que se abre el micrófono hasta que se envía. */
export function crearFinDeHabla(silencioMs = SILENCIO_PARA_ENVIAR_MS): FinDeHabla {
  let audio = new Float32Array(FRECUENCIA * 4);
  let largo = 0;
  // El volumen se oye siempre: decide mientras no hay Silero, y si Silero falla a mitad, sigue desde donde va.
  const volumen = { oido: OIDO_NUEVO as Oido, cuadros: 0 };
  let silero: { detector: DetectorVoz; oido: Oido; cuadros: number; ventanas: number[] } | null = null;
  let hablo = false;

  const nivel = (k: number) => nivelDb(audio.subarray(k * MUESTRAS_POR_CUADRO, (k + 1) * MUESTRAS_POR_CUADRO));

  async function avanzar(): Promise<Aviso> {
    let calloVolumen = false;
    let habloVolumen = false;
    let vozMsVolumen = 0;
    for (; (volumen.cuadros + 1) * MUESTRAS_POR_CUADRO <= largo; volumen.cuadros++) {
      const r = oir(volumen.oido, nivel(volumen.cuadros), silencioMs);
      volumen.oido = r.oido;
      calloVolumen ||= r.termino;
      habloVolumen ||= r.vozMs > 0;
      vozMsVolumen = Math.max(vozMsVolumen, r.vozMs);
    }
    const s = silero;
    if (!s) {
      hablo ||= habloVolumen;
      return { callo: calloVolumen, hablo, vozMs: vozMsVolumen };
    }
    try {
      while ((s.ventanas.length + 1) * MUESTRAS_POR_VENTANA <= largo) {
        const desde = s.ventanas.length * MUESTRAS_POR_VENTANA;
        s.ventanas.push(await s.detector.oir(audio.slice(desde, desde + MUESTRAS_POR_VENTANA)));
      }
    } catch (e) {
      // Desde ya decide el volumen, que siguió oyendo todo.
      silero = null;
      hablo ||= habloVolumen;
      return { callo: calloVolumen, hablo, vozMs: vozMsVolumen, fallo: e instanceof Error ? e.message : "desconocido" };
    }
    let callo = false;
    let vozMs = 0;
    for (; (s.cuadros + 1) * MUESTRAS_POR_CUADRO <= largo; s.cuadros++) {
      const probabilidad = sileroDelCuadro(s.ventanas, s.cuadros);
      if (probabilidad === null) break;
      const r = oir(s.oido, nivel(s.cuadros), silencioMs, probabilidad);
      s.oido = r.oido;
      callo ||= r.termino;
      hablo ||= r.vozMs > 0;
      vozMs = Math.max(vozMs, r.vozMs);
    }
    return { callo, hablo, vozMs };
  }

  // Una cosa a la vez y en orden: Silero recuerda lo anterior, y lo que llega mientras piensa espera su turno.
  let turno: Promise<unknown> = Promise.resolve();
  const enOrden = (paso: () => void) => {
    const hecho = turno.then(() => {
      paso();
      return avanzar();
    });
    turno = hecho.catch(() => {});
    return hecho;
  };

  return {
    oir: (muestras) =>
      enOrden(() => {
        if (largo + muestras.length > audio.length) {
          const mas = new Float32Array(Math.max(audio.length * 2, largo + muestras.length));
          mas.set(audio.subarray(0, largo));
          audio = mas;
        }
        audio.set(muestras, largo);
        largo += muestras.length;
      }),
    conSilero: (detector) =>
      enOrden(() => {
        silero = { detector, oido: OIDO_NUEVO, cuadros: 0, ventanas: [] };
      }),
  };
}
