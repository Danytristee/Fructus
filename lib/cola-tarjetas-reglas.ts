// Las tarjetas que salen de la cola sin conexión (ADR-0019): qué es un dictado que volvió, cómo se vuelve a anotar algo que
// la base rechazó y cuánto vendido falta enviar. Lógica pura.
import type { Entrada, Operacion } from "./cola-reglas";
import { formatearCajas, formatearSoles } from "./formato";
import { formatearGrados } from "./temperatura-reglas";
import type { Tarjeta } from "./voz/tarjeta-reglas";

type Opcion = { id: number; nombre: string };
type Eleccion = { elegido: { nombre: string } | null; dicho?: string | null } | null | undefined;
const nombreDe = (e: Eleccion) => e?.elegido?.nombre ?? e?.dicho ?? null;
// «de el flaco» → «del flaco», «a el gordo» → «al gordo»: lo dicho a veces trae el artículo.
const de = (x: string) => (/^el /i.test(x) ? `del ${x.slice(3)}` : `de ${x}`);
const a = (x: string) => (/^el /i.test(x) ? `al ${x.slice(3)}` : `a ${x}`);
const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Qué es un dictado que volvió como tarjeta, en pocas palabras: «tu abono de Don Lucho · S/ 50.00». Para que el aviso diga qué hay
 * que confirmar y no solo «1 dictado» (/formidable 2026-11-12). Se lee la tarjeta tal como la mandó el servidor.
 */
export function queEsLaTarjeta(tarjeta: unknown): string {
  const t = (tarjeta ?? {}) as Record<string, unknown> & { tipo?: string };
  const dinero = (n: unknown) => (typeof n === "number" && n > 0 ? formatearSoles(n) : null);
  const partes: (string | null)[] = [];
  switch (t.tipo) {
    case "venta": {
      const quien = nombreDe(t.cliente as Eleccion);
      partes.push(quien ? `tu venta ${a(quien)}` : "tu venta", dinero(t.total));
      break;
    }
    case "abono": {
      const quien = nombreDe(t.cliente as Eleccion);
      partes.push(quien ? `tu abono ${de(quien)}` : "tu abono", dinero(t.monto));
      break;
    }
    case "merma": {
      const que = nombreDe(t.producto as Eleccion);
      partes.push(que ? `tu merma ${de(que)}` : "tu merma", typeof t.cantidad === "number" && t.cantidad > 0 ? formatearCajas(t.cantidad) : null);
      break;
    }
    case "gasto":
      partes.push("tu gasto", dinero(t.monto));
      break;
    case "compra": {
      const quien = nombreDe(t.proveedor as Eleccion);
      partes.push(quien ? `tu compra ${a(quien)}` : "tu compra");
      break;
    }
    case "temperatura":
      partes.push("la temperatura", typeof t.grados === "number" ? formatearGrados(t.grados) : null);
      break;
    case "consulta":
      partes.push("tu pregunta");
      break;
    default:
      partes.push("lo que dictaste");
  }
  return partes.filter(Boolean).join(" · ");
}

/** La elección para volver a anotar: lo que se tenía queda como «lo que dijiste», y elegido solo si sigue valiendo. */
function eleccion(p: Opcion | null, quitar: boolean) {
  return { dicho: p?.nombre ?? null, elegido: quitar ? null : p, opciones: [] };
}

/**
 * La tarjeta para «Anotarlo otra vez» lo que la base rechazó (/formidable 2026-11-12): con todo lo que ya se había puesto, salvo lo
 * que causó el rechazo, que queda por elegir. Si el cliente (o el proveedor) ya no está, se vacía; si la fruta ya no está, también.
 * Nada se inventa: lo que falta se pide en la tarjeta antes de dejar guardar.
 */
export function tarjetaParaAnotar(op: Operacion, error: string | undefined): Tarjeta {
  const quitarPersona = /cliente|proveedor/i.test(error ?? "");
  const quitarFruta = /fruta/i.test(error ?? "");
  switch (op.tipo) {
    case "venta": {
      const b = op.entrada.borrador;
      const items = b.items.map((it) => ({
        producto: eleccion(it.productoId === null ? null : { id: it.productoId, nombre: it.producto }, quitarFruta || it.productoId === null),
        cantidad: it.cantidad,
        precio: { valor: it.precio, sugerido: it.sugerido },
        subtotal: it.precio === null ? null : redondear(it.cantidad * it.precio),
      }));
      const cliente = eleccion(b.cliente, quitarPersona);
      const sinPrecio = items.some((it) => it.precio.valor === null);
      const falta: ("cliente" | "precio" | "condicion" | "producto")[] = [];
      if (b.condicion === "credito" && !cliente.elegido) falta.push("cliente");
      if (items.some((it) => !it.producto.elegido)) falta.push("producto");
      if (sinPrecio) falta.push("precio");
      if (b.condicion === null) falta.push("condicion");
      const descuento = b.descuento ?? 0;
      return {
        tipo: "venta",
        cliente,
        items,
        descuento,
        total: sinPrecio ? null : redondear(items.reduce((s, it) => s + (it.subtotal ?? 0), 0) - descuento),
        condicion: b.condicion,
        medio: b.medio,
        comprobante: b.comprobante ?? "ninguno",
        dudas: [],
        falta,
      };
    }
    case "abono": {
      const b = op.entrada.borrador;
      const cliente = eleccion(b.cliente, quitarPersona);
      return { tipo: "abono", cliente, monto: b.monto, medio: b.medio, dudas: [], falta: cliente.elegido ? [] : ["cliente"] };
    }
    case "merma": {
      const b = op.entrada.borrador;
      const producto = eleccion(b.producto, quitarFruta);
      return { tipo: "merma", producto, cantidad: b.cantidad, motivo: b.motivo, falta: producto.elegido ? [] : ["producto"] };
    }
    case "gasto": {
      const b = op.entrada.borrador;
      return { tipo: "gasto", categoria: b.categoria, monto: b.monto ?? 0, descripcion: b.descripcion, medio: b.medio };
    }
    case "compra": {
      const b = op.entrada.borrador;
      const proveedor = eleccion(b.proveedor, quitarPersona);
      const items = b.items.map((it) => ({
        producto: eleccion(it.productoId === null ? null : { id: it.productoId, nombre: it.producto }, quitarFruta || it.productoId === null),
        cantidad: it.cantidad,
        costo: { valor: it.precio, sugerido: it.sugerido },
      }));
      const falta: ("proveedor" | "producto" | "costo" | "condicion")[] = [];
      if (b.condicion === "credito" && !proveedor.elegido) falta.push("proveedor");
      if (items.some((it) => !it.producto.elegido)) falta.push("producto");
      if (items.some((it) => it.costo.valor === null)) falta.push("costo");
      if (b.condicion === null) falta.push("condicion");
      return { tipo: "compra", proveedor, items, condicion: b.condicion, dudas: [], falta };
    }
    case "temperatura":
      // Sin la de ayer: al volver a anotarla no hay con qué comparar, y la tarjeta no avisa de un salto que no puede medir.
      return { tipo: "temperatura", grados: op.entrada.borrador.grados, ayer: null };
  }
}

/**
 * Las ventas confirmadas que todavía están en el celular: cuántas y cuánto suman. «Vendiste hoy» viene de la base y no las cuenta
 * todavía; se dicen aparte para que el dueño sepa si su total está completo (/formidable 2026-11-12).
 */
export function ventasPorEnviar(entradas: readonly Entrada[]): { cuantas: number; total: number } {
  let cuantas = 0;
  let total = 0;
  for (const e of entradas) {
    if (e.estado !== "pendiente" || e.contenido.clase !== "confirmacion" || e.contenido.operacion.tipo !== "venta") continue;
    const b = e.contenido.operacion.entrada.borrador;
    cuantas += 1;
    total += b.items.reduce((s, it) => s + it.cantidad * (it.precio ?? 0), 0) - (b.descuento ?? 0);
  }
  return { cuantas, total: redondear(total) };
}
