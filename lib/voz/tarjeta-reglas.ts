// De lo que entendió el intérprete a la tarjeta que ve la persona (docs/interprete-voz.md, sección 5).
// Reglas de dinero: nunca se inventa un precio (si no lo dijo, se sugiere el último y se marca «sugerido»), nunca se asume
// contado (si no lo dijo, se pregunta), y el total solo existe si todos los precios existen. Lógica pura: no importa React
// ni Supabase; las búsquedas en la base las hace lib/voz/resolver.ts y llegan aquí como datos.
import { formatearSoles } from "../formato";
import type { Respuesta } from "./consultas-reglas";
import type { EstadoLlegada } from "../vida-util-reglas";
import type { Interpretacion } from "./esquemas";

/** Desde esta similitud (pg_trgm) un nombre se elige solo; por debajo, la persona elige entre las 3 mejores (CLAUDE.md, «La voz»). */
const SIMILITUD_SUFICIENTE = 0.45;
// Si el segundo queda a menos de esto del mejor, es un empate: «manzana verde» calza igual con la Premium y con la Comercial, y
// elegir una sola sería adivinar (principio 1). Medido con el catálogo real: «kiwi» da 0.45 / 0.33 y tiene que preguntar;
// «membrillo cuarta» da 0.85 / 0.55 y elige solo.
const MARGEN_EMPATE = 0.15;

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
      /** Al crédito, lo que pagó al llevarse la fruta («pagó solo 1000», ADR-0023). null o ausente: no pagó nada al llevar. */
      pagoParcial?: number | null;
      comprobante: "ninguno" | "boleta" | "factura";
      dudas: string[];
      /** Lo que falta para poder confirmar: la tarjeta lo pide antes de dejar guardar. */
      falta: ("cliente" | "precio" | "condicion" | "producto")[];
    }
  // monto null: un abono a mano (A8) arranca sin monto; el intérprete siempre trae uno.
  | { tipo: "abono"; cliente: Eleccion; monto: number | null; medio: Medio; dudas: string[]; falta: "cliente"[] }
  | {
      tipo: "compra";
      proveedor: Eleccion;
      /**
       * costo por caja: el dicho, o el último que se pagó por esa fruta (marcado «sugerido»). null si no hay ninguno.
       * estado: cómo llegó la fruta (verde, pintón, maduro), si se dijo. Es opcional: no es dinero ni stock.
       */
      items: { producto: Eleccion; cantidad: number; costo: { valor: number | null; sugerido: boolean }; estado?: EstadoLlegada | null }[];
      /** La temperatura con la que se cuenta hoy, para decir cuánto va a aguantar lo que llegó. null si no se anotó ninguna. */
      temperatura?: number | null;
      /** null: se pregunta con dos botones. Nunca se asume contado (20261031211551_compra_por_voz). */
      condicion: "contado" | "credito" | null;
      dudas: string[];
      falta: ("proveedor" | "producto" | "costo" | "condicion")[];
    }
  | { tipo: "merma"; producto: Eleccion; cantidad: number; motivo: string | null; falta: "producto"[] }
  | { tipo: "gasto"; categoria: string; monto: number; descripcion: string | null; medio: Medio }
  /** `ayer`: la temperatura del día anterior, para avisar si la de hoy se aleja mucho (un «39» por «29»). null si no se anotó. */
  | { tipo: "temperatura"; grados: number; ayer: number | null }
  | {
      tipo: "consulta";
      consulta: Extract<Interpretacion, { herramienta: "consultar" }>["datos"]["consulta"];
      cliente: Eleccion | null;
      producto: Eleccion | null;
      /** La respuesta ya armada (/api/voz la agrega con lib/voz/consultas.ts); null si falta elegir o todavía no se responde. */
      respuesta: Respuesta | null;
    }
  | { tipo: "no_entendido"; mensaje: string };

/** Lo que trajeron las búsquedas en la base, en el mismo orden que la interpretación. */
export type Resolucion = {
  clientes: Candidato[];
  proveedores: Candidato[];
  /** Una lista de candidatos por ítem (o una sola, para merma y consultas de producto). */
  productos: Candidato[][];
  /** El precio (venta) o costo (compra) sugerido de cada ítem; null si no hay producto elegido o no hay ninguno. */
  precios: (number | null)[];
  /** La temperatura de ayer, solo para la tarjeta de la temperatura. */
  temperaturaAyer?: number | null;
  /** La temperatura con la que se cuenta hoy, solo para la tarjeta de la compra. */
  temperaturaHoy?: number | null;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** El precio por caja de un total dicho («10 cajas, todo por 500» → 50). null si no sale exacto en céntimos (100 entre 3). */
export function precioDeTotal(total: number, cajas: number): number | null {
  if (!(cajas > 0) || !(total > 0)) return null;
  const centimos = Math.round(total * 100);
  const cajasCentesimas = Math.round(cajas * 100);
  // total = cajas × precio, todo en céntimos: el precio es exacto si (total × 100) es múltiplo de (cajas × 100).
  return (centimos * 100) % cajasCentesimas === 0 ? (centimos * 100) / cajasCentesimas / 100 : null;
}

/** Si el mejor candidato se parece lo suficiente y le saca ventaja al segundo, se elige solo; si no, se ofrecen los 3 mejores para tocar uno. */
export function elegir(dicho: string | null, candidatos: Candidato[]): Eleccion {
  if (!dicho) return { dicho: null, elegido: null, opciones: [] };
  const orden = [...candidatos].sort((a, b) => b.similitud - a.similitud);
  const mejor = orden[0];
  const segundo = orden[1];
  const empata = segundo !== undefined && mejor !== undefined && mejor.similitud - segundo.similitud < MARGEN_EMPATE;
  if (mejor && mejor.similitud >= SIMILITUD_SUFICIENTE && !empata) return { dicho, elegido: { id: mejor.id, nombre: mejor.nombre }, opciones: [] };
  return { dicho, elegido: null, opciones: orden.slice(0, 3).map(({ id, nombre }) => ({ id, nombre })) };
}

/** Arma la tarjeta. Nunca completa dinero que no se dijo sin marcarlo como sugerido. */
export function armarTarjeta(i: Interpretacion, r: Resolucion): Tarjeta {
  switch (i.herramienta) {
    case "registrar_venta": {
      const d = i.datos;
      const cliente = elegir(d.cliente_texto, r.clientes);
      const dudas = [...d.dudas];
      // Precios que salieron de dividir un total dicho: no alcanzan para decidir solo que pagó todo (ver pagoCubre).
      let algunoDeTotal = false;
      const items: ItemTarjeta[] = d.items.map((it, n) => {
        const producto = elegir(it.producto_texto, r.productos[n] ?? []);
        // Dijo el total de esa fruta («todo por 500»): el precio es la división, si sale exacta en céntimos. Si no, no se sugiere
        // otro precio (contradiría lo dicho): queda por elegir, con la duda escrita.
        const total = it.precio_unitario === null ? (it.total_item ?? null) : null;
        if (total !== null) {
          algunoDeTotal = true;
          const dividido = precioDeTotal(total, it.cantidad);
          if (dividido === null) dudas.push(`Dijiste ${formatearSoles(total)} por ${it.cantidad} cajas: elige el precio de la caja.`);
          const valor = dividido;
          return { producto, cantidad: it.cantidad, precio: { valor, sugerido: false }, subtotal: valor === null ? null : redondear(it.cantidad * valor) };
        }
        const sugerido = producto.elegido ? (r.precios[n] ?? null) : null;
        const precio = it.precio_unitario !== null ? { valor: it.precio_unitario, sugerido: false } : { valor: sugerido, sugerido: sugerido !== null };
        return { producto, cantidad: it.cantidad, precio, subtotal: precio.valor === null ? null : redondear(it.cantidad * precio.valor) };
      });
      const descuento = d.descuento_total ?? 0;
      const sinPrecio = items.some((x) => x.subtotal === null);
      const total = sinPrecio ? null : redondear(items.reduce((s, x) => s + (x.subtotal ?? 0), 0) - descuento);
      // Pagar una parte es dejar el resto debiendo: al crédito, aunque el intérprete no lo haya dicho (ADR-0023). Pagar el total o
      // más («me dio 500 y le di 50 de vuelto») es al contado: no hay parte que deber.
      // Solo con precios dichos por caja. Con un precio sugerido, o sacado de dividir un total, no se decide solo que pagó todo: Gemini
      // tomó «a doscientos cincuenta» por un total, y con «pagó mil quinientos» la venta salía al contado (/voz-precision 2026-11-17).
      // Ahí queda al crédito, y la tarjeta pide revisar cuánto pagó antes de confirmar.
      const pagoCubre =
        d.pago_parcial != null && total !== null && !algunoDeTotal && !items.some((x) => x.precio.sugerido) && d.pago_parcial >= total;
      const pagoParcial = pagoCubre ? null : (d.pago_parcial ?? null);
      const condicion = pagoCubre ? "contado" : pagoParcial !== null ? "credito" : d.condicion;
      const falta: Extract<Tarjeta, { tipo: "venta" }>["falta"] = [];
      if (items.some((x) => !x.producto.elegido)) falta.push("producto");
      if (sinPrecio) falta.push("precio");
      if (condicion === null) falta.push("condicion");
      // Al crédito hay que saber quién debe (la base también lo exige: venta_credito_requiere_cliente).
      if (condicion === "credito" && !cliente.elegido) falta.push("cliente");
      return {
        tipo: "venta",
        cliente,
        items,
        descuento,
        total,
        condicion,
        medio: condicion === "contado" || pagoParcial !== null ? (d.medio_pago ?? "efectivo") : d.medio_pago,
        pagoParcial,
        comprobante: d.comprobante,
        dudas,
        falta,
      };
    }
    case "registrar_abono": {
      const cliente = elegir(i.datos.cliente_texto, r.clientes);
      return { tipo: "abono", cliente, monto: i.datos.monto, medio: i.datos.medio_pago, dudas: i.datos.dudas, falta: cliente.elegido ? [] : ["cliente"] };
    }
    case "registrar_compra": {
      const proveedor = elegir(i.datos.proveedor_texto, r.proveedores);
      const items = i.datos.items.map((it, n) => {
        const producto = elegir(it.producto_texto, r.productos[n] ?? []);
        const sugerido = producto.elegido ? (r.precios[n] ?? null) : null;
        const costo = it.costo_unitario !== null ? { valor: it.costo_unitario, sugerido: false } : { valor: sugerido, sugerido: sugerido !== null };
        return { producto, cantidad: it.cantidad, costo, estado: it.estado };
      });
      const falta: Extract<Tarjeta, { tipo: "compra" }>["falta"] = [];
      // Al crédito hay que saber a quién se le debe (la base también lo exige: compra_credito_requiere_proveedor).
      if (i.datos.condicion === "credito" && !proveedor.elegido) falta.push("proveedor");
      if (items.some((x) => !x.producto.elegido)) falta.push("producto");
      if (items.some((x) => x.costo.valor === null)) falta.push("costo");
      if (i.datos.condicion === null) falta.push("condicion");
      return { tipo: "compra", proveedor, items, condicion: i.datos.condicion, dudas: i.datos.dudas, falta, temperatura: r.temperaturaHoy ?? null };
    }
    case "registrar_merma": {
      const producto = elegir(i.datos.producto_texto, r.productos[0] ?? []);
      return { tipo: "merma", producto, cantidad: i.datos.cantidad, motivo: i.datos.motivo, falta: producto.elegido ? [] : ["producto"] };
    }
    case "registrar_gasto":
      return { tipo: "gasto", categoria: i.datos.categoria, monto: i.datos.monto, descripcion: i.datos.descripcion, medio: i.datos.medio_pago };
    case "registrar_temperatura":
      return { tipo: "temperatura", grados: i.datos.grados, ayer: r.temperaturaAyer ?? null };
    case "consultar":
      return {
        tipo: "consulta",
        consulta: i.datos.consulta,
        cliente: i.datos.cliente_texto ? elegir(i.datos.cliente_texto, r.clientes) : null,
        producto: i.datos.producto_texto ? elegir(i.datos.producto_texto, r.productos[0] ?? []) : null,
        respuesta: null,
      };
    case "no_entendido":
      return { tipo: "no_entendido", mensaje: "No te entendí, inténtalo otra vez." };
  }
}
