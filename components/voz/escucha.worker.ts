// «Hola Fructus» en segundo plano (actividad 5c): un worker que carga los tres modelos con onnxruntime-web, recibe el micrófono en
// cuadros de 80 ms (public/voz/captura-worklet.js) y busca la frase. Al oírla avisa y graba lo que sigue, con los 2 s de antes, hasta
// que la pantalla le pide terminar; entonces devuelve el WAV. Nada de esto pasa por el hilo de la pantalla.
//
// Cuándo se calló después de la frase lo decide Silero (ADR-0029), que se carga después de los modelos de la frase: si no baja, decide
// el volumen, y «Hola Fructus» sigue igual.
//
// Lo carga components/voz/useHolaFructus.ts solo cuando el interruptor está prendido: «Hoy» no paga ni un byte de esto (ADR-0006).

import * as ort from "onnxruntime-web/wasm";

import { FRECUENCIA, crearDetector, type Detector } from "@/lib/voz/detector-palabra";
import { crearDetectorVoz, type ModeloVoz } from "@/lib/voz/detector-voz";
import { CUADROS_PREVIOS, empezarDictado, guardarCuadro, muestrasDe, seguirDictado, type Dictado } from "@/lib/voz/escucha-reglas";
import { crearFinDeHabla } from "@/lib/voz/fin-de-habla";
import { modeloDeSesion, modeloVozDeSesion } from "@/lib/voz/modelo-onnx";
import { ATENCION_NUEVA, atender } from "@/lib/voz/palabra-reglas";
import { wavDe } from "@/lib/voz/wav";

export type MensajeAlWorker =
  /** El canal por donde llegan los cuadros del micrófono. Cada vez que se abre el micrófono llega uno nuevo. */
  | { tipo: "puerto"; puerto: MessagePort }
  /** Buscar la frase (después de una pausa, desde cero). */
  | { tipo: "seguir" }
  /** Dejar de buscar: lo que llegue se ignora. */
  | { tipo: "pausar" }
  /** Terminar lo que se graba después de despertar: devolverlo como WAV, o tirarlo. */
  | { tipo: "terminar"; enviar: boolean };

export type MensajeDelWorker =
  | { tipo: "listo" }
  | { tipo: "fallo"; motivo: string }
  | { tipo: "desperto" }
  | { tipo: "callo" }
  | { tipo: "mudo" }
  | { tipo: "grabacion"; wav: ArrayBuffer; duracionMs: number }
  | { tipo: "nada" }
  /** Silero no cargó o se cayó: después de la frase decide el volumen. Solo para el registro. */
  | { tipo: "sin_silero"; motivo: string };

// Lo que se usa del ámbito del worker. Sin `/// <reference lib="webworker" />`: esos tipos chocan con los del DOM en el mismo proyecto.
type Ambito = { postMessage: (m: MensajeDelWorker, transferir: Transferable[]) => void; onmessage: ((e: MessageEvent<MensajeAlWorker>) => void) | null };
const yo = self as unknown as Ambito;
const decir = (m: MensajeDelWorker, transferir: Transferable[] = []) => yo.postMessage(m, transferir);

/** Si el detector se atrasa más de esto (~1 s), se salta lo viejo: lo que importa es lo que se dice ahora. */
const ATRASO_MAXIMO = 12;

let detector: Detector | null = null;
let atencion = ATENCION_NUEVA;
let fase: "pausada" | "atenta" | "dictado" = "pausada";
let previos: Int16Array[] = [];
let dictado: Dictado | null = null;
/** El cuadro del dictado que se está oyendo ahora: si la pantalla cierra el dictado mientras tanto, va igual al WAV. */
let enVuelo: Int16Array | null = null;
let modeloVoz: ModeloVoz | null = null;
let cola: Int16Array[] = [];
let procesando = false;
let entrada: MessagePort | null = null;

async function cargar() {
  // Sin aislamiento entre orígenes no hay memoria compartida: un solo hilo, que para estos modelos alcanza.
  ort.env.wasm.numThreads = 1;
  const sesion = async (archivo: string) => {
    const r = await fetch(`/voz/${archivo}`);
    if (!r.ok) throw new Error(`no se pudo bajar ${archivo} (HTTP ${r.status})`);
    return modeloDeSesion(await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer())), ort.Tensor);
  };
  detector = await crearDetector({
    espectrograma: await sesion("melspectrogram.onnx"),
    rasgos: await sesion("embedding_model.onnx"),
    palabra: await sesion("hola-fructus.onnx"),
  });
}

/** Silero, para saber cuándo se calló después de la frase. Va después de los modelos de la frase: no demora el «listo». */
async function cargarSilero() {
  const r = await fetch("/voz/silero_vad_16k_op15.onnx");
  if (!r.ok) throw new Error(`no se pudo bajar el detector de voz (HTTP ${r.status})`);
  modeloVoz = modeloVozDeSesion(await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer())), ort.Tensor);
}

/** El oído de un dictado nuevo: con su propio Silero si ya está (recuerda lo anterior: uno por dictado), si no, el volumen. */
function oidoDelDictado() {
  const oido = crearFinDeHabla();
  if (modeloVoz) void oido.conSilero(crearDetectorVoz(modeloVoz));
  return oido;
}

/** Vuelve a buscar la frase desde cero: lo de antes de la pausa no cuenta. */
function volverAEscuchar() {
  detector?.reiniciar();
  atencion = ATENCION_NUEVA;
  previos = [];
  dictado = null;
  enVuelo = null;
  fase = "atenta";
}

async function uno(cuadro: Int16Array) {
  if (fase === "dictado" && dictado) {
    const d = dictado;
    enVuelo = cuadro;
    const r = await seguirDictado(d, cuadro);
    // Se cerró o se pausó mientras se oía: el cuadro ya fue al WAV (ver `terminar`) y lo que diga el oído ya no es de nadie.
    if (dictado !== d) return;
    enVuelo = null;
    dictado = r.dictado;
    if (r.fallo) decir({ tipo: "sin_silero", motivo: r.fallo.slice(0, 160) });
    if (r.mudo) decir({ tipo: "mudo" });
    else if (r.callo) decir({ tipo: "callo" });
    return;
  }
  if (fase !== "atenta" || !detector) return;
  previos = [...previos, cuadro].slice(-CUADROS_PREVIOS);
  const r = atender(atencion, await detector.oir(cuadro));
  atencion = r.atencion;
  if (r.desperto && fase === "atenta") {
    dictado = empezarDictado(previos, oidoDelDictado());
    previos = [];
    fase = "dictado";
    decir({ tipo: "desperto" });
  }
}

/** Procesa en orden todo lo que llegó; una sola vuelta a la vez (el detector recuerda lo anterior, no se puede saltar el orden). */
async function procesar() {
  if (procesando) return;
  procesando = true;
  try {
    while (cola.length > 0) await uno(cola.shift()!);
  } catch (e) {
    fase = "pausada";
    cola = [];
    decir({ tipo: "fallo", motivo: e instanceof Error ? e.message : "desconocido" });
  } finally {
    procesando = false;
  }
}

function alLlegar(cuadro: Int16Array) {
  if (fase === "pausada") return;
  cola.push(cuadro);
  // Atrasado buscando la frase: se salta lo viejo y se empieza de nuevo. Grabando lo dictado nunca se salta nada (Silero es liviano).
  if (fase === "atenta" && cola.length > ATRASO_MAXIMO) {
    cola = cola.slice(-1);
    volverAEscuchar();
  }
  void procesar();
}

/**
 * Cierra el dictado en el acto, con todo lo que ya llegó del micrófono (el final de lo que se dijo). Es inmediato a propósito: la
 * pantalla manda «pausar» enseguida, y si esto esperara, «pausar» borraría el dictado antes. Para el WAV no hace falta oír, así que
 * el cuadro que se estaba oyendo y lo que esté en la cola se agregan aquí mismo, sin esperar a Silero.
 */
function terminar(enviar: boolean) {
  if (fase === "dictado" && dictado) {
    if (enVuelo) dictado = guardarCuadro(dictado, enVuelo);
    for (const c of cola) dictado = guardarCuadro(dictado, c);
    cola = [];
  }
  const d = dictado;
  // Lo que llegue después ya es otra cosa: se vuelve a buscar la frase (la pantalla dirá si pausar).
  volverAEscuchar();
  if (!d || !enviar) return decir({ tipo: "nada" });
  const muestras = muestrasDe(d);
  const wav = wavDe(muestras, FRECUENCIA);
  decir({ tipo: "grabacion", wav, duracionMs: Math.round((muestras.length / FRECUENCIA) * 1000) }, [wav]);
}

yo.onmessage = (e: MessageEvent<MensajeAlWorker>) => {
  const m = e.data;
  switch (m.tipo) {
    case "puerto":
      entrada?.close();
      entrada = m.puerto;
      entrada.onmessage = (c: MessageEvent<Int16Array>) => alLlegar(c.data);
      return;
    case "seguir":
      if (fase === "pausada") volverAEscuchar();
      return;
    case "pausar":
      fase = "pausada";
      cola = [];
      dictado = null;
      enVuelo = null;
      return;
    case "terminar":
      return terminar(m.enviar);
  }
};

cargar().then(
  () => {
    decir({ tipo: "listo" });
    cargarSilero().catch((e: unknown) => decir({ tipo: "sin_silero", motivo: e instanceof Error ? e.message.slice(0, 160) : "desconocido" }));
  },
  (e: unknown) => decir({ tipo: "fallo", motivo: e instanceof Error ? e.message : "desconocido" }),
);
