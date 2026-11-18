// El oído de la grabación con el toque y de las respuestas de manos libres: un worker que carga Silero con onnxruntime-web y, mientras
// se graba, recibe el micrófono en cuadros de 80 ms (public/voz/captura-worklet.js) y avisa cuándo la persona habló y cuándo se calló
// (lib/voz/fin-de-habla.ts). Mientras el modelo baja decide el volumen, y si no baja, también: nunca se queda sin oído.
//
// Lo crea components/voz/oido.ts la primera vez que se graba y queda para las siguientes: «Hoy» no paga nada de esto al abrir
// (ADR-0006), y el modelo se carga una sola vez. ONNX Runtime se importa aparte, al cargar: así el worker arranca liviano y el volumen
// ya oye desde el primer cuadro mientras baja todo lo demás.

import { crearDetectorVoz, type ModeloVoz } from "@/lib/voz/detector-voz";
import { crearFinDeHabla, type Aviso, type FinDeHabla } from "@/lib/voz/fin-de-habla";
import { modeloVozDeSesion } from "@/lib/voz/modelo-onnx";

export type MensajeAlOido =
  /** Empieza una grabación: el audio llega por `puerto`. `escucha` la distingue de las demás. */
  | { tipo: "escuchar"; escucha: number; puerto: MessagePort; silencioMs: number }
  /** Terminó esa grabación: lo que llegue ya no se oye. */
  | { tipo: "soltar"; escucha: number };

export type MensajeDelOido =
  | { tipo: "hablo"; escucha: number }
  | { tipo: "callo"; escucha: number }
  /** Silero no cargó o se cayó: decide el volumen. Solo para el registro. */
  | { tipo: "sin_silero"; motivo: string };

type Ambito = { postMessage: (m: MensajeDelOido) => void; onmessage: ((e: MessageEvent<MensajeAlOido>) => void) | null };
const yo = self as unknown as Ambito;

type Escucha = { fin: FinDeHabla; puerto: MessagePort; hablo: boolean };
const escuchas = new Map<number, Escucha>();
let modelo: ModeloVoz | null = null;

function avisar(id: number, a: Aviso) {
  const e = escuchas.get(id);
  if (!e) return;
  if (a.fallo) yo.postMessage({ tipo: "sin_silero", motivo: a.fallo.slice(0, 160) });
  if (a.hablo && !e.hablo) {
    e.hablo = true;
    yo.postMessage({ tipo: "hablo", escucha: id });
  }
  if (a.callo) yo.postMessage({ tipo: "callo", escucha: id });
}

/** Cada grabación con su propio Silero: el modelo recuerda lo anterior y no se mezcla una con otra. */
const darleSilero = (id: number, e: Escucha, m: ModeloVoz) => void e.fin.conSilero(crearDetectorVoz(m)).then((a) => avisar(id, a));

async function cargar() {
  const ort = await import("onnxruntime-web/wasm");
  // Sin aislamiento entre orígenes no hay memoria compartida: un solo hilo, que para este modelo alcanza.
  ort.env.wasm.numThreads = 1;
  const r = await fetch("/voz/silero_vad_16k_op15.onnx");
  if (!r.ok) throw new Error(`no se pudo bajar el detector de voz (HTTP ${r.status})`);
  const sesion = await ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()));
  modelo = modeloVozDeSesion(sesion, ort.Tensor);
  // Lo que ya se estaba grabando mientras bajaba pasa a Silero, desde el principio.
  for (const [id, e] of escuchas) darleSilero(id, e, modelo);
}

yo.onmessage = (ev: MessageEvent<MensajeAlOido>) => {
  const m = ev.data;
  if (m.tipo === "soltar") {
    escuchas.get(m.escucha)?.puerto.close();
    escuchas.delete(m.escucha);
    return;
  }
  const e: Escucha = { fin: crearFinDeHabla(m.silencioMs), puerto: m.puerto, hablo: false };
  escuchas.set(m.escucha, e);
  if (modelo) darleSilero(m.escucha, e, modelo);
  m.puerto.onmessage = (c: MessageEvent<Int16Array>) => {
    void e.fin.oir(Float32Array.from(c.data, (x) => x / 32768)).then((a) => avisar(m.escucha, a));
  };
};

cargar().catch((e: unknown) => yo.postMessage({ tipo: "sin_silero", motivo: e instanceof Error ? e.message.slice(0, 160) : "desconocido" }));
