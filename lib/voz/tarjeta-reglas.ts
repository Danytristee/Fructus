// De lo que entendió el intérprete a la tarjeta que ve la persona (docs/interprete-voz.md, sección 5).
// Reglas de dinero: nunca se inventa un precio (si no lo dijo, se sugiere el último y se marca «sugerido»), nunca se asume
// contado (si no lo dijo, se pregunta), y el total solo existe si todos los precios existen. Lógica pura: no importa React
// ni Supabase; las búsquedas en la base las hace lib/voz/resolver.ts y llegan aquí como datos.
import type { Interpretacion } from "./esquemas";

/** Desde esta similitud (pg_trgm) un nombre se elige solo; por debajo, la persona elige entre las 3 mejores (CLAUDE.md, «La voz»). */
const SIMILITUD_SUFICIENTE = 0.45;

type Opcion = { id: number; nombre: string };
type Candidato = Opcion & { similitud: number };

/** Un nombre dicho y cómo se resolvió: elegido solo, o con opciones para tocar una. */
export type Eleccion = { dicho: string | null; elegido: Opcion | null; opciones: Opcion[] };

type ItemTarjeta = {
  producto: Eleccion;
  cantidad: number;
  /** precio por caja: el dicho, o el sugerido (último cobrado a ese cliente, o el de referencia). null si no hay ninguno. */
  precio: { valor: number | null; sugerido: boolean };
  subtotal: number | null;
};

type Medio = "efectivo" | "yape" | "plin" | "transferencia";

export type Tarjeta =
  | {
      tipo: "venta";
      cliente: Eleccion;
      items: ItemTarjeta[];
      descuento: number;
      total: number | null;
      /** null: se pregunta con dos botones, Pagó / Lo debe. Nunca se asume contado. */
      condicion: "contado" | "credito" | null;
      medio: Medio | null;
      comprobante: "ninguno" | "boleta" | "factura";
      dudas: string[];
      /** Lo que falta para poder confirmar: la tarjeta lo pide antes de dejar guardar. */
      falta: ("cliente" | "precio" | "condicion" | "producto")[];
    }
  | { tipo: "abono"; cliente: Eleccion; monto: number; medio: Medio; dudas: string[]; falta: "cliente"[] }
  | {
      tipo: "compra";
      proveedor: Eleccion;
      items: { producto: Eleccion; cantidad: number; costo: number | null }[];
      condicion: "contado" | "credito" | null;
      dudas: string[];
      falta: ("producto" | "costo")[];
    }
  | { tipo: "merma"; producto: Eleccion; cantidad: number; motivo: string | null; falta: "producto"[] }
  | { tipo: "gasto"; categoria: string; monto: number; descripcion: string | null; medio: Medio }
  | { tipo: "consulta"; consulta: string; cliente: Eleccion | null; producto: Eleccion | null }
  | { tipo: "no_entendido"; mensaje: string };

/** Lo que trajeron las búsquedas en la base, en el mismo orden que la interpretación. */
export type Resolucion = {
  clientes: Candidato[];
  proveedores: Candidato[];
  /** Una lista de candidatos por ítem (o una sola, para merma y consultas de producto). */
  productos: Candidato[][];
  /** El precio sugerido de cada ítem (ultimo_precio); null si no hay producto elegido o no hay ninguno. */
  precios: (number | null)[];
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Si el mejor candidato se parece lo suficiente, se elige solo; si no, se ofrecen los 3 mejores para tocar uno. */
export function elegir(dicho: string | null, candidatos: Candidato[]): Eleccion {
  if (!dicho) return { dicho: null, elegido: null, opciones: [] };
  const orden = [...candidatos].sort((a, b) => b.similitud - a.similitud);
  const mejor = orden[0];
  if (mejor && mejor.similitud >= SIMILITUD_SUFICIENTE) return { dicho, elegido: { id: mejor.id, nombre: mejor.nombre }, opciones: [] };
  return { dicho, elegido: null, opciones: orden.slice(0, 3).map(({ id, nombre }) => ({ id, nombre })) };
}

/** Arma la tarjeta. Nunca completa dinero que no se dijo sin marcarlo como sugerido. */
export function armarTarjeta(i: Interpretacion, r: Resolucion): Tarjeta {
  switch (i.herramienta) {
    case "registrar_venta": {
      const d = i.datos;
      const cliente = elegir(d.cliente_texto, r.clientes);
      const items: ItemTarjeta[] = d.items.map((it, n) => {
        const producto = elegir(it.producto_texto, r.productos[n] ?? []);
        const sugerido = producto.elegido ? (r.precios[n] ?? null) : null;
        const precio = it.precio_unitario !== null ? { valor: it.precio_unitario, sugerido: false } : { valor: sugerido, sugerido: sugerido !== null };
        return { producto, cantidad: it.cantidad, precio, subtotal: precio.valor === null ? null : redondear(it.cantidad * precio.valor) };
      });
      const descuento = d.descuento_total ?? 0;
      const sinPrecio = items.some((x) => x.subtotal === null);
      const total = sinPrecio ? null : redondear(items.reduce((s, x) => s + (x.subtotal ?? 0), 0) - descuento);
      const falta: Extract<Tarjeta, { tipo: "venta" }>["falta"] = [];
      if (items.some((x) => !x.producto.elegido)) falta.push("producto");
      if (sinPrecio) falta.push("precio");
      if (d.condicion === null) falta.push("condicion");
      // Al crédito hay que saber quién debe (la base también lo exige: venta_credito_requiere_cliente).
      if (d.condicion === "credito" && !cliente.elegido) falta.push("cliente");
      return {
        tipo: "venta",
        cliente,
        items,
        descuento,
        total,
        condicion: d.condicion,
        medio: d.condicion === "contado" ? (d.medio_pago ?? "efectivo") : d.medio_pago,
        comprobante: d.comprobante,
        dudas: d.dudas,
        falta,
      };
    }
    case "registrar_abono": {
      const cliente = elegir(i.datos.cliente_texto, r.clientes);
      return { tipo: "abono", cliente, monto: i.datos.monto, medio: i.datos.medio_pago, dudas: i.datos.dudas, falta: cliente.elegido ? [] : ["cliente"] };
    }
    case "registrar_compra": {
      const items = i.datos.items.map((it, n) => ({ producto: elegir(it.producto_texto, r.productos[n] ?? []), cantidad: it.cantidad, costo: it.costo_unitario }));
      const falta: ("producto" | "costo")[] = [];
      if (items.some((x) => !x.producto.elegido)) falta.push("producto");
      if (items.some((x) => x.costo === null)) falta.push("costo");
      return { tipo: "compra", proveedor: elegir(i.datos.proveedor_texto, r.proveedores), items, condicion: i.datos.condicion, dudas: i.datos.dudas, falta };
    }
    case "registrar_merma": {
      const producto = elegir(i.datos.producto_texto, r.productos[0] ?? []);
      return { tipo: "merma", producto, cantidad: i.datos.cantidad, motivo: i.datos.motivo, falta: producto.elegido ? [] : ["producto"] };
    }
    case "registrar_gasto":
      return { tipo: "gasto", categoria: i.datos.categoria, monto: i.datos.monto, descripcion: i.datos.descripcion, medio: i.datos.medio_pago };
    case "consultar":
      return {
        tipo: "consulta",
        consulta: i.datos.consulta,
        cliente: i.datos.cliente_texto ? elegir(i.datos.cliente_texto, r.clientes) : null,
        producto: i.datos.producto_texto ? elegir(i.datos.producto_texto, r.productos[0] ?? []) : null,
      };
    case "no_entendido":
      return { tipo: "no_entendido", mensaje: "No te entendí, inténtalo otra vez." };
  }
}
