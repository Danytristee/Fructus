// Lo que Fructus pregunta en manos libres cuando a la venta, la compra o el abono le falta un dato (ADR-0027): cuál, en qué orden y
// con qué palabras. «Falta el precio. ¿A cuánto la caja de Mango Kent?». La respuesta la completa el intérprete (mensajeCorreccion,
// con el dato preguntado) y la tarjeta se rehace; lectura-reglas.ts y guion-reglas.ts deciden qué se dice después. Lógica pura.
import { faltaAbono, type BorradorAbono } from "./confirmar-abono-reglas";
import { faltaCompra, type BorradorCompra } from "./confirmar-compra-reglas";
import { PRECIO_MAXIMO, faltaDe, type Borrador, type ItemBorrador } from "./confirmar-venta-reglas";
import type { FaltaPreguntada } from "./esquemas";
import { cajasHabladas, nombreHablado } from "./hablado-reglas";
import type { Tarjeta } from "./tarjeta-reglas";

/** Cómo quedó un nombre en la tarjeta, para preguntarlo: lo que se dijo y las opciones parecidas (sus nombres). */
type NombreDicho = { dicho: string | null; opciones: string[] };
/** Lo dicho y las opciones de la tarjeta vigente: del cliente y de cada fruta, en el orden de la venta. */
export type OpcionesVenta = { cliente: NombreDicho; productos: NombreDicho[] };
export const SIN_OPCIONES: OpcionesVenta = { cliente: { dicho: null, opciones: [] }, productos: [] };

const nombreDicho = (e: { dicho: string | null; opciones: { nombre: string }[] }): NombreDicho => ({ dicho: e.dicho, opciones: e.opciones.map((o) => o.nombre) });

/** Las opciones de una tarjeta de venta, para preguntar por voz lo que falta elegir. */
export function opcionesDeVenta(t: Extract<Tarjeta, { tipo: "venta" }>): OpcionesVenta {
  return { cliente: nombreDicho(t.cliente), productos: t.items.map((it) => nombreDicho(it.producto)) };
}

/** Lo mismo para la compra (el proveedor y cada fruta) y el abono (el cliente). */
export type OpcionesCompra = { proveedor: NombreDicho; productos: NombreDicho[] };
export type OpcionesAbono = { cliente: NombreDicho };

export function opcionesDeCompra(t: Extract<Tarjeta, { tipo: "compra" }>): OpcionesCompra {
  return { proveedor: nombreDicho(t.proveedor), productos: t.items.map((it) => nombreDicho(it.producto)) };
}
export function opcionesDeAbono(t: Extract<Tarjeta, { tipo: "abono" }>): OpcionesAbono {
  return { cliente: nombreDicho(t.cliente) };
}

type DatoDeFruta = "producto" | "cantidad" | "precio" | "costo";
const sinPrecio = (it: ItemBorrador) => it.precio === null || !(it.precio > 0) || it.precio > PRECIO_MAXIMO;
// La compra tampoco acepta más de dos decimales en las cajas (faltaCompra).
const sinCajas = (it: ItemBorrador) => !(it.cantidad > 0) || Math.round(it.cantidad * 100) !== it.cantidad * 100;

/** El dato de una fruta que falta: en qué fruta (la primera) y, si es la fruta misma, sus opciones (hasta 3). */
function deFruta(items: ItemBorrador[], dato: DatoDeFruta, productos: NombreDicho[]): FaltaPreguntada {
  const n = items.findIndex(dato === "producto" ? (it) => it.productoId === null : dato === "cantidad" ? sinCajas : sinPrecio);
  if (n === -1) return { dato, item: null, opciones: [] };
  return { dato, item: n, opciones: dato === "producto" ? (productos[n]?.opciones ?? []).slice(0, 3) : [] };
}

/**
 * Lo que se pregunta por voz cuando falta, en este orden: la fruta (de ella sale el precio sugerido), las cajas, el precio y a quién
 * se le fía. Si pagó va al final, con su propia pregunta. Lo que pagó al llevar, si no cuadra, se elige en la tarjeta.
 */
const SE_PREGUNTA = ["producto", "cantidad", "precio", "cliente"] as const;

/** El primer dato que falta y se puede preguntar hablando, con las opciones que se leerán. null si no hay ninguno. */
export function faltaPorPreguntar(b: Borrador, opciones: OpcionesVenta = SIN_OPCIONES): FaltaPreguntada | null {
  const falta = faltaDe(b);
  const dato = SE_PREGUNTA.find((d) => falta.includes(d));
  if (!dato) return null;
  if (dato === "cliente") return { dato, item: null, opciones: opciones.cliente.opciones.slice(0, 3) };
  return deFruta(b.items, dato, opciones.productos);
}

/** En la compra, igual que en la venta: la fruta, las cajas, el costo y, si se debe, a quién. Si se pagó tiene su pregunta. */
const SE_PREGUNTA_COMPRA = ["producto", "cantidad", "costo", "proveedor"] as const;

export function faltaPorPreguntarCompra(b: BorradorCompra, opciones: OpcionesCompra): FaltaPreguntada | null {
  const falta = faltaCompra(b);
  const dato = SE_PREGUNTA_COMPRA.find((d) => falta.includes(d));
  if (!dato) return null;
  if (dato === "proveedor") return { dato, item: null, opciones: opciones.proveedor.opciones.slice(0, 3) };
  return deFruta(b.items, dato, opciones.productos);
}

/** En el abono: quién pagó y cuánto. */
export function faltaPorPreguntarAbono(b: BorradorAbono, opciones: OpcionesAbono): FaltaPreguntada | null {
  const falta = faltaAbono(b);
  if (falta.includes("cliente")) return { dato: "cliente", item: null, opciones: opciones.cliente.opciones.slice(0, 3) };
  if (falta.includes("monto")) return { dato: "monto", item: null, opciones: [] };
  return null;
}

/** «Mango Kent», «Mango Kent o Mango Edward», «Mango Kent, Mango Edward o Mango Haden». */
const unaU = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(", ")} o ${xs.at(-1)}`);

/** «Las 10 cajas», «la caja», «la media caja», para preguntar por ellas. */
function lasCajas(n: number): string {
  if (n === 1) return "la caja";
  if (n === 0.5) return "la media caja";
  return `las ${cajasHabladas(n)}`;
}
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const elegirEntre = (f: FaltaPreguntada) => (f.opciones.length > 0 ? ` ¿${unaU(f.opciones.map(nombreHablado))}?` : "");

/** La pregunta por una persona: con opciones, cuál; si se dijo un nombre y no se encontró nada parecido, lo dice. */
function preguntaPersona(f: FaltaPreguntada, nombre: NombreDicho, conOpciones: string, sinOpciones: string): string {
  const elegir = elegirEntre(f);
  if (elegir) return `${conOpciones}${elegir}`;
  const dicho = nombre.dicho?.trim() || null;
  return `${dicho ? `No encontré a ${dicho}. ` : ""}${sinOpciones}`;
}

/** La pregunta por un dato de una fruta: cuál es, cuántas cajas o a cuánto. `llevo`: «llevó» en la venta, «llegó» en la compra. */
function preguntaFruta(items: ItemBorrador[], f: FaltaPreguntada, productos: NombreDicho[], { llevo, precio }: { llevo: string; precio: string }): string {
  const it = f.item === null ? null : (items[f.item] ?? null);
  const nombre = it?.producto ? ` de ${nombreHablado(it.producto)}` : "";
  switch (f.dato) {
    case "cantidad":
      return `¿Cuántas cajas${nombre}?`;
    case "precio":
    case "costo":
      return `¿${precio}${nombre}?`;
    default: {
      if (!it || !(it.cantidad > 0)) return `¿Qué fruta ${llevo}, y cuántas cajas?`;
      const dicho = productos[f.item!]?.dicho?.trim() || null;
      const cajas = lasCajas(it.cantidad);
      const elegir = elegirEntre(f);
      if (elegir) return `${mayuscula(cajas)}${dicho ? ` de ${dicho}` : ""}, ¿cuál es?${elegir}`;
      return `${dicho ? `No encontré ${dicho}. ` : ""}¿Qué fruta ${it.cantidad === 1 || it.cantidad === 0.5 ? "es" : "son"} ${cajas}?`;
    }
  }
}

/**
 * La pregunta por un dato que falta en la venta, corta y con lo que hace falta para responderla:
 *   «Las 10 cajas de mango, ¿cuál es? ¿Mango Kent o Mango Edward?», «¿A cuánto la caja de Mango Kent?», «¿A quién se lo fiaste?».
 * Si se dijo un nombre y no se encontró nada parecido, lo dice: «No encontré a Lucho. ¿A quién se lo fiaste?».
 */
export function preguntaFalta(b: Borrador, f: FaltaPreguntada, opciones: OpcionesVenta = SIN_OPCIONES): string {
  if (f.dato === "cliente") return preguntaPersona(f, opciones.cliente, "¿Para quién es?", "¿A quién se lo fiaste?");
  return preguntaFruta(b.items, f, opciones.productos, { llevo: "llevó", precio: "A cuánto la caja" });
}

/** En la compra: «¿A cuánto te costó la caja de Plátano Isla?», «¿A quién se la compraste? ¿Agrícola Chao o Frutos del Norte?». */
export function preguntaFaltaCompra(b: BorradorCompra, f: FaltaPreguntada, opciones: OpcionesCompra): string {
  if (f.dato === "proveedor") return preguntaPersona(f, opciones.proveedor, "¿A quién se la compraste?", "¿A quién se la compraste?");
  return preguntaFruta(b.items, f, opciones.productos, { llevo: "llegó", precio: "A cuánto te costó la caja" });
}

/** En el abono: «¿Quién te pagó? ¿Luis Paredes o Luis Pérez?», «¿Cuánto te dio Luis Paredes?». */
export function preguntaFaltaAbono(b: BorradorAbono, f: FaltaPreguntada, opciones: OpcionesAbono): string {
  if (f.dato === "cliente") return preguntaPersona(f, opciones.cliente, "¿Quién te pagó?", "¿Quién te pagó?");
  return b.cliente ? `¿Cuánto te dio ${b.cliente.nombre}?` : "¿Cuánto te dio?";
}

/** Lo que falta, corto, para decirlo antes de preguntar: «Falta el precio y si pagó.» */
const FALTA_DICHA: Record<string, string> = {
  producto: "la fruta",
  cantidad: "las cajas",
  precio: "el precio",
  costo: "el costo",
  cliente: "el cliente",
  proveedor: "el proveedor",
  monto: "cuánto te dio",
  condicion: "si pagó",
  pago: "cuánto pagó",
};
/** `condicion`: cómo se dice que falta saber si se pagó («si la pagaste», en la compra). */
export const faltaDicha = (falta: string[], { condicion = "si pagó" }: { condicion?: string } = {}) =>
  `Falta ${unaY(falta.map((f) => (f === "condicion" ? condicion : (FALTA_DICHA[f] ?? f))))}.`;
const unaY = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
