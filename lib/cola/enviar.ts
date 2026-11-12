// Envía una entrada de la cola sin conexión y dice qué pasó (ADR-0017). Usa las mismas server actions que las tarjetas
// y el mismo POST /api/voz que el botón: no hay un camino aparte que pueda guardar distinto. Solo navegador.
import { abrirComandoAMano, type IntencionAMano } from "@/app/(app)/acciones-a-mano";
import { confirmarAbono, confirmarCompra, confirmarGasto, confirmarMerma } from "@/app/(app)/acciones-operaciones";
import { confirmarVenta } from "@/app/(app)/acciones-voz";
import { NO_ABRIO } from "@/lib/a-mano-reglas";
import { desenlaceConfirmacion, sinComando, type Desenlace, type Entrada, type Operacion } from "@/lib/cola-reglas";
import { desenlaceDeRespuesta } from "@/lib/voz/envio-reglas";
import { actualizar } from "./almacen";

// Los mismos topes que la tarjeta y el botón de voz: con la señal colgada, la cola no se queda esperando para siempre.
const TOPE_CONFIRMAR_MS = 15_000;
const TOPE_AUDIO_MS = 25_000;

function conTope<T>(trabajo: Promise<T>, ms: number): Promise<T | "tope"> {
  let reloj = 0;
  const tope = new Promise<"tope">((resolve) => {
    reloj = window.setTimeout(() => resolve("tope"), ms);
  });
  return Promise.race([trabajo, tope]).finally(() => window.clearTimeout(reloj));
}

function confirmar(op: Operacion) {
  switch (op.tipo) {
    case "venta":
      return confirmarVenta(op.entrada);
    case "abono":
      return confirmarAbono(op.entrada);
    case "merma":
      return confirmarMerma(op.entrada);
    case "gasto":
      return confirmarGasto(op.entrada);
    case "compra":
      return confirmarCompra(op.entrada);
  }
}

/**
 * Una tarjeta «a mano» que se abrió sin señal todavía no tiene comando: se abre ahora y se guarda su número en la cola
 * ANTES de confirmar. Si después se pierde la respuesta, el reintento usa el mismo comando y no guarda dos veces.
 */
async function conComando(entrada: Entrada, op: Operacion): Promise<Operacion | Desenlace> {
  if (!sinComando(op.entrada.comandoId)) return op;
  if (op.tipo === "venta") return { tipo: "rechazo", error: "Esa venta no tiene comando. Regístrala otra vez." };
  const r = await conTope(abrirComandoAMano(`registrar_${op.tipo}` as IntencionAMano).catch(() => "tope" as const), TOPE_CONFIRMAR_MS);
  if (r === "tope") return { tipo: "reintentar" };
  if (!r.ok) {
    if (r.sinSesion) return { tipo: "sin_sesion" };
    return r.error === NO_ABRIO ? { tipo: "reintentar" } : { tipo: "rechazo", error: r.error };
  }
  const conNumero = { ...op, entrada: { ...op.entrada, comandoId: r.comandoId } } as Operacion;
  await actualizar({ ...entrada, contenido: { clase: "confirmacion", operacion: conNumero } });
  return conNumero;
}

async function enviarConfirmacion(entrada: Entrada, op: Operacion): Promise<Desenlace> {
  const lista = await conComando(entrada, op);
  if (!("entrada" in lista)) return lista;
  const r = await conTope(confirmar(lista).catch(() => "tope" as const), TOPE_CONFIRMAR_MS);
  // Sin respuesta no se sabe si llegó: se reintenta, y la base devuelve lo mismo si ya estaba guardado.
  if (r === "tope") return { tipo: "reintentar" };
  return desenlaceConfirmacion(r);
}

async function enviarAudio(audio: Blob, duracionMs: number): Promise<Desenlace> {
  const formulario = new FormData();
  formulario.append("audio", audio, audio.type.includes("mp4") ? "voz.m4a" : "voz.webm");
  formulario.append("duracion_ms", String(duracionMs));
  const desde = performance.now();
  try {
    const r = await fetch("/api/voz", { method: "POST", body: formulario, signal: AbortSignal.timeout(TOPE_AUDIO_MS) });
    if (r.status === 401) return { tipo: "sin_sesion" };
    const d = desenlaceDeRespuesta(r.status, await r.json().catch(() => null));
    if (d.tipo === "tarjeta") return { tipo: "tarjeta", comandoId: d.comandoId, tarjeta: d.tarjeta, latenciaMs: Math.round(performance.now() - desde) };
    // Falló un servicio (Groq, la base): el mismo audio sirve más tarde. Si lo que se dijo no se entendió, no.
    return d.conservarAudio ? { tipo: "reintentar" } : { tipo: "rechazo", error: d.mensaje };
  } catch (e) {
    console.error("cola: no se pudo enviar un audio", { error: e instanceof Error ? e.name : "desconocido" });
    return { tipo: "reintentar" };
  }
}

export function enviar(entrada: Entrada): Promise<Desenlace> {
  const c = entrada.contenido;
  if (c.clase === "confirmacion") return enviarConfirmacion(entrada, c.operacion);
  if (c.clase === "audio") return enviarAudio(c.audio, c.duracionMs);
  return Promise.resolve({ tipo: "hecho" }); // una tarjeta por confirmar no se envía: espera a la persona
}
