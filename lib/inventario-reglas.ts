// El dashboard inteligente de inventario: con el stock, la demanda y la edad de cada lote, decide qué fruta está por
// malograrse, cuál sobra, cuál hay que reponer y qué conviene hacer. Lógica pura: no importa React ni Supabase.

import { detalleProducto, nombreProducto, type PartesProducto } from "./productos-reglas";

/**
 * Días que aguanta una caja en buen estado en el puesto (sin cámara de frío). Valores de referencia para la demo, por
 * familia de fruta; se ajustan con el dueño y, si hace falta, pasan a una columna de productos.
 */
const VIDA_UTIL_DIAS: Record<string, number> = {
  manzana: 30,
  pera: 20,
  kiwi: 25,
  uva: 10,
  ciruela: 10,
  naranja: 15,
  tangelo: 15,
  lima: 15,
  pina: 7,
  platano: 6,
  mango: 7,
  papaya: 5,
  chirimoya: 5,
  granadilla: 12,
  nispero: 7,
  tuna: 7,
  kaki: 10,
  arandano: 10,
  sandia: 10,
  aguaymanto: 10,
  cocona: 6,
  carambola: 7,
};

const clave = (nombre: string) => nombre.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(" ")[0] ?? "";

export function vidaUtilDias(nombre: string): number {
  return VIDA_UTIL_DIAS[clave(nombre)] ?? 10;
}

const DIA_MS = 86_400_000;

/**
 * La edad, en días, del lote más viejo que todavía está en stock. Se recorre de la entrada más nueva a la más vieja (lo
 * primero que entra es lo primero que sale): las entradas recientes cubren el stock, y la última que hace falta es la más
 * vieja que queda. null si no hay stock.
 */
export function edadLoteMasViejo(stock: number, entradas: { fecha: string; cantidad: number }[], hoy: Date): number | null {
  if (stock <= 0) return null;
  const orden = [...entradas].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  let cubierto = 0;
  let masVieja: string | undefined;
  for (const e of orden) {
    cubierto += e.cantidad;
    masVieja = e.fecha;
    if (cubierto >= stock) break;
  }
  return masVieja ? Math.max(0, Math.floor((hoy.getTime() - Date.parse(masVieja)) / DIA_MS)) : null;
}

type Gravedad = "alta" | "media";
export type TipoAlerta = "deterioro" | "reponer" | "sobrestock" | "sin_movimiento";

export type Alerta = {
  productoId: number;
  producto: string;
  tipo: TipoAlerta;
  gravedad: Gravedad;
  /** Qué pasa, en una frase de puesto. */
  titulo: string;
  /** Por qué, con los números. */
  detalle: string;
  /** Qué hacer. */
  recomendacion: string;
};

export type ProductoInventario = PartesProducto & {
  id: number;
  stock: number;
  /** Cajas vendidas en los últimos 7 días. */
  vendido7: number;
  /** Entradas de compra (fecha y cajas), para la edad del lote. */
  entradas: { fecha: string; cantidad: number }[];
  precioReferencia: number | null;
};

export type EstadoProducto = {
  id: number;
  /** El nombre en una frase, sin confusiones: «Manzana Roja americana Premium cal. 113» (lib/productos-reglas.ts). */
  nombre: string;
  /** La línea chica debajo del nombre: «Nordic · cal. 100 · 18 kg». */
  detalle: string;
  /** Las partes, para ordenar y agrupar la lista como el catálogo. */
  partes: PartesProducto;
  stock: number;
  demandaDiaria: number;
  /** Días que alcanza el stock al ritmo de venta actual; null si no se vende. */
  coberturaDias: number | null;
  edadDias: number | null;
  vidaUtil: number;
  /** De 0 a 1: cuánto de su vida útil ya pasó el lote más viejo. */
  desgaste: number;
  alertas: Alerta[];
};

// Cajas y días enteros, como se dice en el puesto: «unas 136 cajas», no «136.3» («no vendo media caja», prueba a ciegas de /formidable
// 2026-11-09). Lo que no llega a uno se dice en palabras.
export const cajas = (n: number) => (n > 0 && n < 1 ? "menos de una caja" : `${Math.round(n)} ${Math.round(n) === 1 ? "caja" : "cajas"}`);
const dias = (n: number) => (n > 0 && n < 1 ? "menos de un día" : `${Math.round(n)} ${Math.round(n) === 1 ? "día" : "días"}`);

/** Lo que pide hacer algo HOY: un aviso grave, el mismo que en la lista de Stock lleva la etiqueta roja «Hoy». */
const esUrgente = (a: Pick<Alerta, "gravedad">) => a.gravedad === "alta";

/**
 * El veredicto del anillo de Stock: de las frutas que lleva el puesto, cuántas piden algo hoy: las que tienen la etiqueta roja «Hoy» en la
 * lista de abajo (se acabó, por malograrse, o te sobra tanta que se malogra antes de venderse). Lo que puede esperar («Pronto») no cuenta. La primera versión contaba todos los avisos y decía «8 de 8 frutas con
 * aviso»: asustaba y no cuadraba con las cajitas (2.ª prueba a ciegas de /formidable 2026-11-09).
 */
export function veredictoDelStock(estados: Pick<EstadoProducto, "stock" | "alertas">[]): { urgentes: number; total: number } {
  const seguidas = estados.filter((e) => e.stock > 0 || e.alertas.length > 0);
  return { urgentes: seguidas.filter((e) => e.alertas.some(esUrgente)).length, total: seguidas.length };
}

/** Las reglas de negocio de una fruta: deterioro, reposición, sobrestock y fruta que no se mueve. */
export function evaluarProducto(p: ProductoInventario, hoy: Date): EstadoProducto {
  const nombre = nombreProducto(p);
  const vidaUtil = vidaUtilDias(p.nombre);
  const demandaDiaria = p.vendido7 / 7;
  const coberturaDias = demandaDiaria > 0 ? p.stock / demandaDiaria : null;
  const edadDias = edadLoteMasViejo(p.stock, p.entradas, hoy);
  const desgaste = edadDias === null ? 0 : Math.min(1, edadDias / vidaUtil);
  const alertas: Alerta[] = [];
  const base = { productoId: p.id, producto: nombre };

  // Deterioro: el lote más viejo ya gastó la mayor parte de su vida útil.
  if (edadDias !== null && desgaste >= 0.6) {
    const alta = desgaste >= 0.85;
    alertas.push({
      ...base,
      tipo: "deterioro",
      gravedad: alta ? "alta" : "media",
      titulo: alta ? `${nombre} se está por malograr` : `${nombre} hay que revisarlo pronto`,
      detalle: `El lote más viejo tiene ${dias(edadDias)} y esta fruta dura unos ${dias(vidaUtil)}.`,
      recomendacion: alta ? "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja." : "Ponlo adelante y véndelo primero.",
    });
  }

  if (p.stock <= 0) {
    if (demandaDiaria > 0) {
      alertas.push({
        ...base,
        tipo: "reponer",
        gravedad: "alta",
        titulo: `Se acabó ${nombre}`,
        detalle: `Vendes unas ${cajas(demandaDiaria)} al día y no te queda ninguna.`,
        recomendacion: `Compra unas ${cajas(Math.ceil(demandaDiaria * 4))} para cubrir 4 días.`,
      });
    }
  } else if (coberturaDias === null) {
    // Hay stock y no se vendió nada en 7 días.
    alertas.push({
      ...base,
      tipo: "sin_movimiento",
      gravedad: "media",
      titulo: `${nombre} no se está vendiendo`,
      detalle: `Tienes ${cajas(p.stock)} y no vendiste ninguna en 7 días.`,
      recomendacion: "Ofrécelo a tus clientes de siempre o con una rebaja; no compres más.",
    });
  } else {
    // Sobrestock: al ritmo de venta, parte del stock se malogra antes de venderse.
    const vidaRestante = Math.max(0, vidaUtil - (edadDias ?? 0));
    const seAlcanzaAVender = demandaDiaria * vidaRestante;
    const enRiesgo = p.stock - seAlcanzaAVender;
    // Si ya se está por malograr, esa alerta dice lo mismo y más urgente: no se repite como sobrestock.
    const yaPorMalograrse = alertas.some((a) => a.tipo === "deterioro" && a.gravedad === "alta");
    if (enRiesgo >= 1 && !yaPorMalograrse) {
      alertas.push({
        ...base,
        tipo: "sobrestock",
        gravedad: enRiesgo / p.stock >= 0.3 ? "alta" : "media",
        titulo: `Te sobra ${nombre}`,
        detalle: `Tienes ${cajas(p.stock)} y vendes ${cajas(demandaDiaria)} al día: unas ${cajas(Math.ceil(enRiesgo))} no alcanzan a venderse antes de malograrse.`,
        recomendacion: "No compres más hasta que baje. Muévelo con precio o con tus clientes grandes.",
      });
    }
    // Reponer: lo que hay no alcanza para 2 días.
    if (coberturaDias < 2) {
      alertas.push({
        ...base,
        tipo: "reponer",
        gravedad: coberturaDias < 1 ? "alta" : "media",
        titulo: `Te queda poco ${nombre}`,
        detalle: `Tienes ${cajas(p.stock)}: te alcanza para ${dias(coberturaDias)} al ritmo de venta.`,
        recomendacion: `Compra unas ${cajas(Math.max(1, Math.ceil(demandaDiaria * 4 - p.stock)))} para cubrir 4 días.`,
      });
    }
  }

  const partes: PartesProducto = { nombre: p.nombre, variedad: p.variedad, marca: p.marca, seleccion: p.seleccion, calibre: p.calibre, kgPorCaja: p.kgPorCaja };
  return { id: p.id, nombre, detalle: detalleProducto(p), partes, stock: p.stock, demandaDiaria, coberturaDias, edadDias, vidaUtil, desgaste, alertas };
}

const ORDEN_TIPO: Record<TipoAlerta, number> = { deterioro: 0, reponer: 1, sobrestock: 2, sin_movimiento: 3 };

/** Todas las alertas, de la más urgente a la menos: primero lo grave, y dentro, lo que se malogra antes que lo que falta. */
export function priorizarAlertas(estados: EstadoProducto[]): Alerta[] {
  return estados
    .flatMap((e) => e.alertas)
    .sort((a, b) => (a.gravedad === b.gravedad ? ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] : a.gravedad === "alta" ? -1 : 1));
}

export type ResumenInventario = {
  cajas: number;
  /** Lo que vale el stock a precio de referencia (proyectado). */
  valor: number;
  alertasAltas: number;
  /** Cajas del lote más viejo de las frutas que se están por malograr. */
  frutasPorMalograrse: number;
  porReponer: number;
};

export function resumirInventario(productos: ProductoInventario[], estados: EstadoProducto[]): ResumenInventario {
  const alertas = estados.flatMap((e) => e.alertas);
  return {
    cajas: productos.reduce((s, p) => s + Math.max(0, p.stock), 0),
    valor: Math.round(productos.reduce((s, p) => s + Math.max(0, p.stock) * (p.precioReferencia ?? 0), 0) * 100) / 100,
    alertasAltas: alertas.filter((a) => a.gravedad === "alta").length,
    frutasPorMalograrse: alertas.filter((a) => a.tipo === "deterioro" && a.gravedad === "alta").length,
    porReponer: alertas.filter((a) => a.tipo === "reponer").length,
  };
}
