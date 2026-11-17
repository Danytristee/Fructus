// Cómo se cuenta cada operación del día en una línea de puesto: quién, qué y cuánto. Lógica pura: no importa React ni Supabase.
import { frutaIlustrada, type FrutaIlustrada } from "./frutas";
import { nombreProducto, type PartesProducto } from "./productos-reglas";

export type Medio = "efectivo" | "yape" | "plin" | "transferencia" | "otro";
type Producto = PartesProducto;
type Item = { cantidad: number; producto: Producto | null };

export type VentaLeida = {
  id: number;
  fecha: string;
  total: number;
  condicion: "contado" | "credito";
  medio: Medio | null;
  cliente: { id: number; nombre: string } | null;
  items: Item[];
};
/** `alLlevar`: lo pagó al llevarse la fruta en una venta al crédito («pagó solo 1000»), no fue un abono suelto (ADR-0023). */
export type AbonoLeido = { id: number; fecha: string; monto: number; medio: Medio; cliente: { id: number; nombre: string } | null; alLlevar?: boolean };
export type CompraLeida = { id: number; fecha: string; total: number; proveedor: { nombre: string } | null; items: Item[] };
export type MermaLeida = { id: number; fecha: string; cantidad: number; motivo: string | null; producto: Producto | null };
export type GastoLeido = { id: number; fecha: string; monto: number; categoria: string; descripcion: string | null };

/** «credito» y «pagaste» son de la ficha del proveedor: una compra fiada y un pago a cuenta, vistos desde tu lado. */
export type Estado = "pago" | "debe" | "abono" | "compra" | "merma" | "gasto" | "anulada" | "credito" | "pagaste";

export type Operacion = {
  clave: string;
  fecha: string;
  titulo: string;
  detalle: string;
  /** null en una merma: se perdió fruta, no plata que se cobró o se pagó. */
  monto: number | null;
  estado: Estado;
  /** Iniciales y tono del avatar, si hay una persona detrás. */
  persona: { iniciales: string; tono: number } | null;
  fruta: FrutaIlustrada | null;
};

const PALABRAS_CHICAS = new Set(["de", "del", "la", "las", "el", "los", "y"]);

/** «Juguería El Paraíso» → «JP», «Rosa Quispe» → «RQ». */
export function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p && !PALABRAS_CHICAS.has(p.toLowerCase()));
  return palabras
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Un tono fijo por cliente (0–359): la misma persona tiene siempre el mismo color. */
export function tonoDe(id: number): number {
  return (id * 137) % 360;
}

export const medios: Record<Medio, string> = {
  efectivo: "en efectivo",
  yape: "con Yape",
  plin: "con Plin",
  transferencia: "por transferencia",
  otro: "por otro medio",
};

// En la frase va en minúsculas, como se dice: «10 de manzana verde premium». El calibre, con su nombre (lib/productos-reglas.ts).
const nombreEnFrase = (p: Producto | null) => (p ? nombreProducto(p).toLowerCase() : "fruta");

const cantidad = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("es-PE"));

/** «10 de mango kent», «5 de plátano de seda y 3 de piña golden», «4 de mango kent, 2 de uva y 1 más». */
export function describirItems(items: Item[]): string {
  const partes = items.map((i) => `${cantidad(i.cantidad)} de ${nombreEnFrase(i.producto)}`);
  if (partes.length <= 2) return partes.join(" y ");
  return `${partes.slice(0, 2).join(", ")} y ${partes.length - 2} más`;
}

const persona = (c: { id: number; nombre: string } | null) => (c ? { iniciales: iniciales(c.nombre), tono: tonoDe(c.id) } : null);
const primeraFruta = (items: Item[]) =>
  items.map((i) => (i.producto ? frutaIlustrada(nombreEnFrase(i.producto)) : null)).find((f) => f !== null) ?? null;

export function deVenta(v: VentaLeida): Operacion {
  const items = describirItems(v.items);
  return {
    clave: `venta-${v.id}`,
    fecha: v.fecha,
    titulo: v.cliente?.nombre ?? "Venta al paso",
    detalle: v.condicion === "contado" && v.medio ? `${items}, ${medios[v.medio]}` : items,
    monto: v.total,
    estado: v.condicion === "credito" ? "debe" : "pago",
    persona: persona(v.cliente),
    fruta: primeraFruta(v.items),
  };
}

export function deAbono(a: AbonoLeido): Operacion {
  return {
    clave: `abono-${a.id}`,
    fecha: a.fecha,
    titulo: a.cliente?.nombre ?? "Abono",
    detalle: a.alLlevar ? `Pagó al llevar, ${medios[a.medio]}` : `Abonó ${medios[a.medio]}`,
    monto: a.monto,
    estado: "abono",
    persona: persona(a.cliente),
    fruta: null,
  };
}

export function deCompra(c: CompraLeida): Operacion {
  return {
    clave: `compra-${c.id}`,
    fecha: c.fecha,
    titulo: c.proveedor?.nombre ?? "Compra",
    detalle: `Compraste ${describirItems(c.items)}`,
    monto: c.total,
    estado: "compra",
    persona: null,
    fruta: primeraFruta(c.items),
  };
}

export function deMerma(m: MermaLeida): Operacion {
  return {
    clave: `merma-${m.id}`,
    fecha: m.fecha,
    titulo: "Merma",
    detalle: `${cantidad(Math.abs(m.cantidad))} de ${nombreEnFrase(m.producto)}${m.motivo ? `, ${m.motivo}` : ""}`,
    monto: null,
    estado: "merma",
    persona: null,
    fruta: m.producto ? frutaIlustrada(nombreEnFrase(m.producto)) : null,
  };
}

const categorias: Record<string, string> = {
  flete: "Flete",
  alquiler: "Alquiler",
  servicios: "Servicios",
  personal: "Personal",
  otros: "Gasto",
};

export function deGasto(g: GastoLeido): Operacion {
  return {
    clave: `gasto-${g.id}`,
    fecha: g.fecha,
    titulo: g.descripcion ?? categorias[g.categoria] ?? "Gasto",
    detalle: `Gasto de ${(categorias[g.categoria] ?? "otros").toLowerCase()}`,
    monto: g.monto,
    estado: "gasto",
    persona: null,
    fruta: null,
  };
}

/** Las n operaciones más recientes, de la última a la primera. */
export function ultimas(operaciones: Operacion[], n = 5): Operacion[] {
  return [...operaciones].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, n);
}
