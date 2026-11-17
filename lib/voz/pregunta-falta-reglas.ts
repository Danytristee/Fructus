// Lo que Fructus pregunta en manos libres cuando a la venta le falta un dato (ADR-0027): cuál, en qué orden y con qué palabras.
// «Falta el precio. ¿A cuánto la caja de Mango Kent?». La respuesta la completa el intérprete (mensajeCorreccion, con el dato
// preguntado) y la tarjeta se rehace; lectura-reglas.ts decide qué se dice después. Lógica pura.
import { PRECIO_MAXIMO, faltaDe, type Borrador, type Falta, type ItemBorrador } from "./confirmar-venta-reglas";
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

/**
 * Lo que se pregunta por voz cuando falta, en este orden: la fruta (de ella sale el precio sugerido), las cajas, el precio y a quién
 * se le fía. Si pagó va al final, con su propia pregunta. Lo que pagó al llevar, si no cuadra, se elige en la tarjeta.
 */
const SE_PREGUNTA: FaltaPreguntada["dato"][] = ["producto", "cantidad", "precio", "cliente"];
const sinPrecio = (it: ItemBorrador) => it.precio === null || !(it.precio > 0) || it.precio > PRECIO_MAXIMO;

/** El primer dato que falta y se puede preguntar hablando, con las opciones que se leerán. null si no hay ninguno. */
export function faltaPorPreguntar(b: Borrador, opciones: OpcionesVenta = SIN_OPCIONES): FaltaPreguntada | null {
  const falta = faltaDe(b);
  const dato = SE_PREGUNTA.find((d) => falta.includes(d));
  if (!dato) return null;
  if (dato === "cliente") return { dato, item: null, opciones: opciones.cliente.opciones.slice(0, 3) };
  const n = b.items.findIndex(dato === "producto" ? (it) => it.productoId === null : dato === "cantidad" ? (it) => !(it.cantidad > 0) : sinPrecio);
  if (n === -1) return { dato, item: null, opciones: [] };
  return { dato, item: n, opciones: dato === "producto" ? (opciones.productos[n]?.opciones ?? []).slice(0, 3) : [] };
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

/**
 * La pregunta por un dato que falta, corta y con lo que hace falta para responderla:
 *   «Las 10 cajas de mango, ¿cuál es? ¿Mango Kent o Mango Edward?», «¿A cuánto la caja de Mango Kent?», «¿A quién se lo fiaste?».
 * Si se dijo un nombre y no se encontró nada parecido, lo dice: «No encontré a Lucho. ¿A quién se lo fiaste?».
 */
export function preguntaFalta(b: Borrador, f: FaltaPreguntada, opciones: OpcionesVenta = SIN_OPCIONES): string {
  const it = f.item === null ? null : (b.items[f.item] ?? null);
  const elegir = f.opciones.length > 0 ? ` ¿${unaU(f.opciones.map(nombreHablado))}?` : "";
  switch (f.dato) {
    case "producto": {
      if (!it || !(it.cantidad > 0)) return "¿Qué fruta llevó, y cuántas cajas?";
      const dicho = opciones.productos[f.item!]?.dicho?.trim() || null;
      const cajas = lasCajas(it.cantidad);
      if (elegir) return `${mayuscula(cajas)}${dicho ? ` de ${dicho}` : ""}, ¿cuál es?${elegir}`;
      return `${dicho ? `No encontré ${dicho}. ` : ""}¿Qué fruta ${it.cantidad === 1 || it.cantidad === 0.5 ? "es" : "son"} ${cajas}?`;
    }
    case "cantidad":
      return it?.producto ? `¿Cuántas cajas de ${nombreHablado(it.producto)}?` : "¿Cuántas cajas?";
    case "precio":
      return it?.producto ? `¿A cuánto la caja de ${nombreHablado(it.producto)}?` : "¿A cuánto la caja?";
    case "cliente": {
      if (elegir) return `¿Para quién es?${elegir}`;
      const dicho = opciones.cliente.dicho?.trim() || null;
      return `${dicho ? `No encontré a ${dicho}. ` : ""}¿A quién se lo fiaste?`;
    }
  }
}

/** Lo que falta, corto, para decirlo antes de preguntar: «Falta el precio y si pagó.» */
const FALTA_DICHA: Record<Falta, string> = { producto: "la fruta", cantidad: "las cajas", precio: "el precio", cliente: "el cliente", condicion: "si pagó", pago: "cuánto pagó" };
export const faltaDicha = (falta: Falta[]) => `Falta ${unaY(falta.map((f) => FALTA_DICHA[f]))}.`;
const unaY = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
