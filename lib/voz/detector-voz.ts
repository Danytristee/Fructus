// Silero VAD en el celular: dice si en un trozo de audio alguien está hablando, de 0 a 1. Un motor, la lluvia sobre el toldo o una jaba
// que cae no son voz aunque suenen fuerte; el volumen solo no lo distingue. Cuándo eso es «se calló» lo decide lib/voz/silencio-reglas.ts.
//
// El modelo es silero_vad_16k_op15.onnx de Silero VAD v6.2 (MIT, docs/terceros/README.md), el de 16 kHz. Se usa como en su código de
// referencia (OnnxWrapper de silero-vad): ventanas de 512 muestras, cada una con las últimas 64 de la anterior delante, y un estado que
// pasa de una ventana a la siguiente. Sin el contexto o sin el estado el modelo responde, pero mal.
//
// No sabe de dónde sale el modelo: se lo pasa quien lo usa (el worker en el navegador, la prueba en Node).

/** El modelo ya cargado: recibe la ventana con su contexto y el estado, y devuelve la probabilidad de voz y el estado nuevo. */
export type ModeloVoz = (entrada: Float32Array, estado: Float32Array) => Promise<{ voz: number; estado: Float32Array }>;

/** 32 ms a 16 kHz: lo único que acepta el modelo de 16 kHz. */
export const MUESTRAS_POR_VENTANA = 512;
/** Lo que se repite de la ventana anterior. */
const CONTEXTO = 64;
/** El estado del modelo: 2 × 1 × 128. */
const LARGO_DEL_ESTADO = 2 * 128;

export type DetectorVoz = {
  /** Una ventana de MUESTRAS_POR_VENTANA muestras (de -1 a 1). Devuelve la probabilidad de que sea voz. En orden: recuerda lo anterior. */
  oir: (ventana: Float32Array) => Promise<number>;
};

/** Un detector nuevo, sin nada oído: uno por cada vez que se escucha. */
export function crearDetectorVoz(modelo: ModeloVoz): DetectorVoz {
  let estado: Float32Array = new Float32Array(LARGO_DEL_ESTADO);
  let contexto = new Float32Array(CONTEXTO);
  return {
    oir: async (ventana) => {
      if (ventana.length !== MUESTRAS_POR_VENTANA) throw new Error(`detector de voz: la ventana tiene ${ventana.length} muestras, no ${MUESTRAS_POR_VENTANA}`);
      const entrada = new Float32Array(CONTEXTO + MUESTRAS_POR_VENTANA);
      entrada.set(contexto);
      entrada.set(ventana, CONTEXTO);
      const r = await modelo(entrada, estado);
      estado = r.estado;
      contexto = entrada.slice(MUESTRAS_POR_VENTANA);
      return r.voz;
    },
  };
}
