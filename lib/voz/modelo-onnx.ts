import type { InferenceSession, Tensor } from "onnxruntime-web";

import type { Modelo } from "./detector-palabra";
import type { ModeloVoz } from "./detector-voz";

// Una sesión de ONNX Runtime como Modelo del detector de «Hola Fructus», y como ModeloVoz del detector de voz (más abajo). El
// constructor de Tensor llega de afuera: en el navegador es el de onnxruntime-web/wasm (dentro del worker) y en las pruebas, el de
// onnxruntime-web para Node. Así este archivo no carga ONNX Runtime y no pesa en ninguna pantalla.

type ConstructorTensor = new (tipo: "float32", datos: Float32Array, forma: readonly number[]) => Tensor;

/** Su única entrada y su primera salida. */
export function modeloDeSesion(sesion: InferenceSession, Tensor: ConstructorTensor): Modelo {
  const entrada = sesion.inputNames[0];
  const salida = sesion.outputNames[0];
  if (!entrada || !salida) throw new Error("detector: el modelo no tiene entrada o salida");
  return async (datos, forma) => {
    const resultado = await sesion.run({ [entrada]: new Tensor("float32", datos, forma) });
    const tensor = resultado[salida];
    if (!tensor || !(tensor.data instanceof Float32Array)) throw new Error("detector: el modelo no devolvió números");
    return tensor.data;
  };
}

type ConstructorTensorVoz = {
  new (tipo: "float32", datos: Float32Array, forma: readonly number[]): Tensor;
  new (tipo: "int64", datos: BigInt64Array, forma: readonly number[]): Tensor;
};

/** Una sesión de Silero VAD (lib/voz/detector-voz.ts): entradas `input`, `state` y `sr`; salidas `output` y `stateN`. */
export function modeloVozDeSesion(sesion: InferenceSession, Tensor: ConstructorTensorVoz): ModeloVoz {
  const frecuencia = new Tensor("int64", BigInt64Array.from([16_000n]), []);
  return async (entrada, estado) => {
    const r = await sesion.run({
      input: new Tensor("float32", entrada, [1, entrada.length]),
      state: new Tensor("float32", estado, [2, 1, 128]),
      sr: frecuencia,
    });
    const voz = r.output?.data;
    const estadoNuevo = r.stateN?.data;
    if (!(voz instanceof Float32Array) || !(estadoNuevo instanceof Float32Array)) throw new Error("detector de voz: el modelo no devolvió números");
    return { voz: voz[0]!, estado: estadoNuevo };
  };
}
