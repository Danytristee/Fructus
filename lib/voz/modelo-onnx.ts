import type { InferenceSession, Tensor } from "onnxruntime-web";

import type { Modelo } from "./detector-palabra";

// Una sesión de ONNX Runtime como Modelo del detector de «Hola Fructus». El constructor de Tensor llega de afuera: en el navegador es
// el de onnxruntime-web/wasm (dentro del worker) y en la prueba de paridad, el de onnxruntime-web para Node. Así este archivo no
// carga ONNX Runtime y no pesa en ninguna pantalla.

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
