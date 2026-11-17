// La cola sin conexión (ADR-0019): lo que la persona confirmó o dictó sin señal se guarda en el celular y se envía solo,
// en el mismo orden, cuando vuelve la señal. Aquí vive lo que se decide sin tocar el navegador: qué se envía primero,
// qué hacer con cada respuesta, cuánto esperar entre intentos y qué dice la franja. Lógica pura.
//
// Por qué es seguro reenviar: cada confirmación lleva su comando y el servidor es idempotente por comando
// (registrar_venta, registrar_compra y el índice único de abonos, mermas y gastos). Si la respuesta se perdió y se
// reenvía, la base devuelve lo mismo y no guarda dos veces.
import type { confirmarVenta } from "@/app/(app)/acciones-voz";
import type { confirmarTemperatura } from "@/app/(app)/acciones-frescura";
import type { confirmarAbono, confirmarCompra, confirmarGasto, confirmarMerma } from "@/app/(app)/acciones-operaciones";
import { formatearCajas, formatearSoles } from "./formato";
import { formatearGrados } from "./temperatura-reglas";
import { nombreOperacion } from "./voz/nombre-operacion-reglas";

/** Lo que dice el servidor cuando la base no respondió: no es un rechazo, se reintenta. */
export const SIN_SENAL = "No se pudo guardar. Revisa tu señal e inténtalo otra vez.";

/**
 * Un comando «a mano» abierto sin señal todavía no tiene número: lleva uno negativo, solo del celular, y el de verdad se
 * abre en el servidor al enviarlo (A8). Negativo y distinto cada vez, para que la hoja se rearme con cada tarjeta.
 */
export const comandoTemporal = (ahora: number) => -ahora;
export const sinComando = (comandoId: number) => comandoId <= 0;

/** Una confirmación que se puede guardar en el celular y enviar después: los datos, no la función. */
export type Operacion =
  | { tipo: "venta"; entrada: Parameters<typeof confirmarVenta>[0] }
  | { tipo: "abono"; entrada: Parameters<typeof confirmarAbono>[0] }
  | { tipo: "merma"; entrada: Parameters<typeof confirmarMerma>[0] }
  | { tipo: "gasto"; entrada: Parameters<typeof confirmarGasto>[0] }
  | { tipo: "compra"; entrada: Parameters<typeof confirmarCompra>[0] }
  | { tipo: "temperatura"; entrada: Parameters<typeof confirmarTemperatura>[0] };

type TipoOperacion = Operacion["tipo"];

/**
 * Cada cosa guardada en el celular:
 * - `confirmacion`: una tarjeta que la persona ya confirmó. Se envía sola.
 * - `audio`: algo dictado sin señal. Se envía solo y vuelve como tarjeta `por_confirmar`: nada se guarda sin que la
 *   persona vea lo que se entendió (principio 1).
 */
export type Contenido =
  | { clase: "confirmacion"; operacion: Operacion }
  /** `despertar`: empezó con «Hola Fructus»; el servidor revisa la frase al enviarlo (actividad 5d). */
  | { clase: "audio"; audio: Blob; duracionMs: number; despertar?: true }
  | { clase: "por_confirmar"; comandoId: number; tarjeta: unknown; latenciaMs: number };

type Estado = "pendiente" | "rechazada";

export type Entrada = {
  /** Lo pone IndexedDB, creciente: es el orden en que se guardó. */
  id: number;
  /** De quién es: en un celular compartido, lo de un ayudante no se envía con la sesión del dueño. */
  usuarioId: string;
  creadoEn: number;
  estado: Estado;
  /** Por qué la base no la aceptó, en lenguaje de puesto. */
  error?: string;
  /** Una línea para la franja: «Venta a Don Lucho · S/ 120.00». */
  resumen: string;
  contenido: Contenido;
};

/** Lo que pasó al enviar una entrada, ya leído. */
export type Desenlace =
  /** `nota`: algo que la persona tiene que saber de lo que entró («Don Lucho quedó con S/ 60.00 a favor»). */
  | { tipo: "hecho"; nota?: string }
  /** El audio volvió como tarjeta: queda esperando a la persona. */
  | { tipo: "tarjeta"; comandoId: number; tarjeta: unknown; latenciaMs: number }
  /** No hubo señal o el servidor no contestó: se reintenta más tarde. */
  | { tipo: "reintentar" }
  /** La sesión venció: se espera a que vuelva a entrar. */
  | { tipo: "sin_sesion" }
  /** La base dijo que no (el cliente ya no está, sin permiso): reintentar no lo arregla. */
  | { tipo: "rechazo"; error: string };

/** De la respuesta de una server action de confirmar a qué hacer con la entrada. */
export function desenlaceConfirmacion(r: { ok: true } | { ok: false; error: string; sinSesion?: true }): Desenlace {
  if (r.ok) return { tipo: "hecho" };
  if (r.sinSesion) return { tipo: "sin_sesion" };
  if (r.error === SIN_SENAL) return { tipo: "reintentar" };
  return { tipo: "rechazo", error: r.error };
}

const esEnviable = (e: Entrada) => e.estado === "pendiente" && e.contenido.clase !== "por_confirmar";

/**
 * La próxima entrada que se envía, o null. Van en el orden en que se guardaron. Una confirmación rechazada frena a las
 * confirmaciones que vienen detrás: si la venta no entró, el abono que se dio después por esa venta no puede entrar
 * solo (principio 3). Los audios no se frenan: vuelven como tarjetas, y nada se guarda sin que la persona las vea.
 */
export function siguiente(entradas: readonly Entrada[], usuarioId: string): Entrada | null {
  let frenada = false;
  for (const e of [...entradas].sort((a, b) => a.id - b.id)) {
    if (e.usuarioId !== usuarioId) continue;
    if (e.contenido.clase === "confirmacion" && e.estado === "rechazada") frenada = true;
    if (!esEnviable(e)) continue;
    if (e.contenido.clase === "confirmacion" && frenada) continue;
    return e;
  }
  return null;
}

/**
 * Cuánto esperar antes de reintentar tras `intentos` fallas seguidas: 5 s, 10 s, 20 s y después cada 30 s. Sin botón de «Enviar
 * ahora» (asustaba: «¿se manda dos veces?», /formidable 2026-11-12), el reintento solo tiene que llegar pronto.
 */
export function esperaTras(intentos: number): number {
  return Math.min(30_000, 5_000 * 2 ** Math.max(0, intentos - 1));
}

const nombres: Record<TipoOperacion, string> = { venta: "Venta", abono: "Abono", merma: "Merma", gasto: "Gasto", compra: "Compra", temperatura: "Temperatura" };

/** «Venta a Don Lucho · 3 cajas · S/ 120.00»: lo justo para reconocerla en la franja. */
export function resumenDe(op: Operacion): string {
  const partes: string[] = [];
  switch (op.tipo) {
    case "venta": {
      const b = op.entrada.borrador;
      partes.push(b.cliente ? `Venta a ${b.cliente.nombre}` : "Venta");
      partes.push(formatearCajas(b.items.reduce((s, it) => s + it.cantidad, 0)));
      const total = b.items.reduce((s, it) => s + it.cantidad * (it.precio ?? 0), 0) - (b.descuento ?? 0);
      if (total > 0) partes.push(formatearSoles(total));
      break;
    }
    case "abono": {
      const b = op.entrada.borrador;
      partes.push(b.cliente ? `Abono de ${b.cliente.nombre}` : "Abono");
      if (b.monto) partes.push(formatearSoles(b.monto));
      break;
    }
    case "merma": {
      const b = op.entrada.borrador;
      partes.push(b.producto ? `Merma de ${b.producto.nombre}` : "Merma", formatearCajas(b.cantidad));
      break;
    }
    case "gasto": {
      const b = op.entrada.borrador;
      partes.push("Gasto");
      if (b.monto) partes.push(formatearSoles(b.monto));
      break;
    }
    case "compra": {
      const b = op.entrada.borrador;
      partes.push(b.proveedor ? `Compra a ${b.proveedor.nombre}` : "Compra", formatearCajas(b.items.reduce((s, it) => s + it.cantidad, 0)));
      break;
    }
    case "temperatura":
      partes.push("Temperatura", formatearGrados(op.entrada.borrador.grados));
      break;
  }
  return partes.join(" · ") || nombres[op.tipo];
}

/** «1 venta», «3 operaciones»: lo que hay por enviar, contado como se dice. */
export function contarPorEnviar(entradas: readonly Entrada[]): string {
  const n = entradas.length;
  if (n === 0) return "";
  const tipos = new Set(entradas.map((e) => (e.contenido.clase === "confirmacion" ? e.contenido.operacion.tipo : "dictado")));
  if (tipos.size === 1) {
    const [palabra] = tipos;
    return `${n} ${palabra}${n === 1 ? "" : "s"}`;
  }
  return `${n} ${n === 1 ? "operación" : "operaciones"}`;
}

export type Situacion = {
  enLinea: boolean;
  /** Lo que falta enviar (pendientes enviables de esta persona). */
  porEnviar: readonly Entrada[];
  /** La primera confirmación que la base no aceptó, si hay. */
  rechazada: Entrada | null;
  enviando: boolean;
  /** La última vez falló por señal: se está esperando para reintentar. */
  esperando: boolean;
  sinSesion: boolean;
  /** Cuántas se enviaron en la última tanda, para decir «Listo» un momento. */
  enviadas: number;
  /** Lo que hay que saber de lo que entró; la franja no se va sola hasta que la persona lo lee. */
  notas: readonly string[];
};

export type Franja =
  | null
  | {
      tono: "sin_senal" | "enviando" | "listo" | "error";
      titulo: string;
      detalle: string | null;
      accion: "entrar" | "anotar" | "entendido" | null;
    };

/**
 * Qué dice la franja de arriba, en orden de lo más urgente. Sin señal siempre se dice (CLAUDE.md, regla 10), haya o no
 * algo guardado. El color nunca va solo: cada tono trae su icono y su texto.
 */
export function franjaDe(s: Situacion): Franja {
  const cuantas = contarPorEnviar(s.porEnviar);
  if (s.rechazada) {
    const c = s.rechazada.contenido;
    const { lo } = nombreOperacion(c.clase === "confirmacion" ? c.operacion.tipo : "operación");
    return {
      tono: "error",
      titulo: `No entró: ${s.rechazada.resumen}`,
      // Solo el motivo: la frase de la tarjeta trae su propia orden («Elige a otro») y chocaba con la de aquí (/formidable 2026-11-12).
      detalle: `${motivo(s.rechazada.error)} Anóta${lo} otra vez con lo correcto.`,
      accion: "anotar",
    };
  }
  if (!s.enLinea) {
    return {
      tono: "sin_senal",
      titulo: "Sin señal",
      detalle: cuantas ? `Por enviar: ${cuantas}. Está en el celular y se envía cuando vuelva.` : "Lo que confirmes se guarda en el celular y se envía cuando vuelva.",
      accion: null,
    };
  }
  if (s.sinSesion && cuantas) {
    return { tono: "error", titulo: "Tu sesión terminó", detalle: `Entra otra vez para enviar lo guardado (${cuantas}).`, accion: "entrar" };
  }
  if (cuantas && s.esperando && !s.enviando) {
    return { tono: "sin_senal", titulo: "La señal está débil", detalle: `Por enviar: ${cuantas}. Lo reintento solo, sin repetir nada.`, accion: null };
  }
  if (cuantas) return { tono: "enviando", titulo: "Enviando lo guardado…", detalle: `Por enviar: ${cuantas}.`, accion: null };
  if (s.notas.length > 0) return { tono: "listo", titulo: "Listo: se envió lo guardado", detalle: s.notas.join(" "), accion: "entendido" };
  if (s.enviadas > 0) {
    return { tono: "listo", titulo: "Listo: se envió lo guardado", detalle: null, accion: null };
  }
  return null;
}

/** La primera frase del error: el porqué, sin la orden que la tarjeta agregaba para corregirlo ahí mismo. */
function motivo(error: string | undefined): string {
  if (!error) return "No se aceptó.";
  const fin = error.indexOf(". ");
  return fin === -1 ? error : error.slice(0, fin + 1);
}
