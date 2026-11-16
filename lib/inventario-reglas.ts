// El dashboard inteligente de inventario: con el stock, la demanda, cuándo llegó cada caja y el calor de cada día, decide qué
// fruta tiene que salir ya, cuál sobra, cuál hay que reponer y qué conviene hacer. Lógica pura: no importa React ni Supabase.

import { diaDeLima } from "./formato";
import { conRevisionDeHoy, cuandoLlego, deCuando, DIAS_DE_ENTRADAS, esDeEstaLlegada, estimarLlegada, llegadaSinFecha, llegadasEnStock, sePasoDeSuDia, type Estimacion, type Llegada, type Revision } from "./frescura-reglas";
import { agruparPorFruta, detalleProducto, nombreProducto, tituloEnGrupo, type PartesProducto } from "./productos-reglas";
import { diaAnterior, type TemperaturaDia } from "./temperatura-reglas";
import type { VidaEstimada } from "./vida-estimada-reglas";
import { NOMBRE_ESTADO, vidaDeLlegada, vidaUtilDias, type EstadoLlegada } from "./vida-util-reglas";

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
  /** El dato en pocas palabras, para cuando la alerta va junto a otras del mismo tipo: «72 de más», «12 cajas del lunes». */
  corto: string;
};

export type ProductoInventario = PartesProducto & {
  id: number;
  stock: number;
  /** Cajas vendidas en los últimos 7 días. */
  vendido7: number;
  /** Entradas de compra o de ajuste a favor (fecha, cajas y cómo llegó la fruta, si se dijo), para la cuenta de cada llegada. */
  entradas: { fecha: string; cantidad: number; estado?: EstadoLlegada | null }[];
  precioReferencia: number | null;
  /** Lo que estimó la IA para esta fruta (ADR-0021). Sin eso, o si no se pudo leer, se cuenta con la tabla. */
  vidaEstimada?: VidaEstimada | null;
  /** Las llegadas de esta fruta que alguien revisó y dijo «Sigue buena». Solo cuentan las de hoy. */
  revisiones?: readonly Revision[];
};

/** De dónde salen los días que aguanta la fruta: de lo que estimó la IA (sus días, de cuándo es, su motivo y lo que decía la tabla) o de la tabla. */
export type OrigenVida = { fuente: "ia"; dias: number; dia: string; motivo: string; tabla: number } | { fuente: "tabla" };

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
  /** Días que aguanta a temperatura normal si llega pintona: lo estimado por la IA o, si no hay, lo de la tabla. */
  vidaUtil: number;
  origenVida: OrigenVida;
  /** De 0 a 1: cuánto de su vida ya gastó la llegada más vieja, contando el calor de cada día. */
  desgaste: number;
  /** Cada llegada que todavía tiene cajas, de la más vieja a la más nueva, con lo que le queda. */
  lotes: LoteEstimado[];
  alertas: Alerta[];
};

/**
 * Una llegada con su cuenta: cuántas cajas quedan de ella y cuánto le falta para su último día bueno. `vida` son los días con
 * los que se contó (a temperatura normal, según cómo llegó); null en las cajas de hace más de 45 días, que no llevan cuenta.
 * `revisada`: ya pasó su último día bueno, pero alguien la miró hoy y sigue buena: sale mañana.
 */
export type LoteEstimado = Llegada & Estimacion & { vida: number | null; revisada: boolean };

// Cajas y días enteros, como se dice en el puesto: «unas 136 cajas», no «136.3» («no vendo media caja», prueba a ciegas de /formidable
// 2026-11-09). Lo que no llega a uno se dice en palabras.
export const cajas = (n: number) => (n > 0 && n < 1 ? "menos de una caja" : `${Math.round(n)} ${Math.round(n) === 1 ? "caja" : "cajas"}`);
const dias = (n: number) => (n > 0 && n < 1 ? "menos de un día" : `${Math.round(n)} ${Math.round(n) === 1 ? "día" : "días"}`);

/** Lo que pide hacer algo HOY: un aviso grave. En Stock va en el grupo «Para hoy». */
const esUrgente = (a: Pick<Alerta, "gravedad">) => a.gravedad === "alta";

/** Por qué esa llegada tiene que salir, en una frase: lo que le quitó el calor, o que ya se pasó. */
function porQueSale(lote: LoteEstimado, hoyMismo: boolean): string {
  if (lote.revisada) return "La revisaste hoy y sigue buena. Mañana vuelve a mirarla.";
  if (lote.antes) return "Revisa la fruta antes de venderla.";
  if (lote.atraso > 0) return `Su último día bueno fue ${lote.atraso === 1 ? "ayer" : `hace ${dias(lote.atraso)}`}: revisa la fruta antes de venderla.`;
  const cuando = hoyMismo ? "hoy" : "mañana";
  return lote.perdidos > 0 ? `El calor le quitó ${dias(lote.perdidos)}: ${cuando} es su último día bueno.` : `${hoyMismo ? "Hoy" : "Mañana"} es su último día bueno.`;
}

/**
 * Las reglas de negocio de una fruta: lo que tiene que salir, reposición, sobrestock y fruta que no se mueve. `lecturas` es la
 * temperatura de cada día; sin ninguna, cada día cuenta como uno normal. Cuánto aguanta la fruta sale de lo que estimó la IA
 * (`p.vidaEstimada`) y, si no hay, de la tabla.
 */
export function evaluarProducto(p: ProductoInventario, hoy: Date, lecturas: readonly TemperaturaDia[] = []): EstadoProducto {
  const nombre = nombreProducto(p);
  const tabla = vidaUtilDias(p.nombre);
  const vidaUtil = p.vidaEstimada?.dias ?? tabla;
  const origenVida: OrigenVida = p.vidaEstimada ? { fuente: "ia", dias: p.vidaEstimada.dias, dia: p.vidaEstimada.dia, motivo: p.vidaEstimada.motivo, tabla } : { fuente: "tabla" };
  const demandaDiaria = p.vendido7 / 7;
  // Con stock negativo (una merma mayor que lo contado) no alcanza para nada: 0 días, no «−4.2 días» (/chaos 2026-11-10).
  const coberturaDias = demandaDiaria > 0 ? Math.max(0, p.stock) / demandaDiaria : null;
  const edadDias = edadLoteMasViejo(p.stock, p.entradas, hoy);
  const hoyDia = diaDeLima(hoy);
  // Cada llegada con su cuenta, primero la que se acaba antes: una que llegó madura ayer puede salir antes que una verde del lunes.
  // Las cajas que las entradas leídas no cubren son de hace más de 45 días: no se les hace la cuenta, piden revisarse hoy.
  const lotes: LoteEstimado[] = llegadasEnStock(p.stock, p.entradas, diaAnterior(hoyDia, DIAS_DE_ENTRADAS))
    .map((l) => {
      const vida = l.antes ? null : vidaDeLlegada(p.nombre, l.estado, vidaUtil);
      const cuenta = vida === null ? llegadaSinFecha(l.dia, hoyDia) : estimarLlegada(l.dia, vida, lecturas, hoyDia);
      // «Sigue buena»: la que ya se pasó y alguien revisó hoy gana un día (sale mañana).
      const revisada = sePasoDeSuDia(cuenta) && (p.revisiones ?? []).some((r) => r.dia === hoyDia && esDeEstaLlegada(r, l));
      return { ...l, vida, revisada, ...(revisada ? conRevisionDeHoy(cuenta, hoyDia) : cuenta) };
    })
    .sort((a, b) => (a.fin === b.fin ? 0 : a.fin < b.fin ? -1 : 1));
  const viejo = lotes[0] ?? null;
  const desgaste = viejo ? viejo.gastado : 0;
  const alertas: Alerta[] = [];
  const base = { productoId: p.id, producto: nombre };

  // Lo que tiene que salir: las llegadas cuyo último día bueno es hoy (o ya pasó) y, si no hay, las que se acaban mañana.
  const deHoy = lotes.filter((l) => l.restan === 0);
  const porSalir = deHoy.length > 0 ? deHoy : lotes.filter((l) => l.restan === 1);
  if (porSalir.length > 0) {
    const alta = deHoy.length > 0;
    const primero = porSalir[0]!; // la que se acaba antes
    const n = porSalir.reduce((s, l) => s + l.cajas, 0);
    alertas.push({
      ...base,
      tipo: "deterioro",
      gravedad: alta ? "alta" : "media",
      titulo: alta ? `${nombre} tiene que salir hoy` : `${nombre} sale mañana`,
      detalle: `${cajas(n)} que ${Math.round(n) === 1 ? "llegó" : "llegaron"} ${cuandoLlego(primero.dia, hoyDia, primero.antes)}${primero.estado ? `, ${NOMBRE_ESTADO[primero.estado].cajas}` : ""}. ${porQueSale(primero, alta)}`,
      recomendacion: alta ? "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja." : "Ponlo adelante y véndelo primero.",
      corto: `${cajas(n)} ${deCuando(primero.dia, hoyDia, primero.antes)}${primero.estado ? `, ${NOMBRE_ESTADO[primero.estado].cajas}` : ""}`,
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
        corto: `se acabó: compra unas ${cajas(Math.ceil(demandaDiaria * 4))}`,
      });
    }
  } else if (coberturaDias === null) {
    // Hay stock y no se vendió nada en 7 días. Solo es «no se está vendiendo» si esas cajas ya estaban hace 7 días: las que llegaron
    // hoy no tuvieron tiempo de venderse (2026-11-10: 20 cajas cargadas hoy salían como «sin vender en 7 días»). Sin entradas en los
    // 45 días que se leen, el stock es más viejo que eso.
    if (edadDias === null || edadDias >= 7) {
      alertas.push({
        ...base,
        tipo: "sin_movimiento",
        gravedad: "media",
        titulo: `${nombre} no se está vendiendo`,
        detalle: `Tienes ${cajas(p.stock)} y no vendiste ninguna en 7 días.`,
        recomendacion: "Ofrécelo a tus clientes de siempre o con una rebaja; no compres más.",
        corto: `${cajas(p.stock)} sin vender en 7 días`,
      });
    }
  } else {
    // Sobrestock: al ritmo de venta, parte del stock se malogra antes de venderse. Los días que quedan para vender son los de la
    // llegada más vieja, hoy incluido; si ya se pasó, ninguno.
    const vidaRestante = viejo ? (viejo.atraso > 0 ? 0 : viejo.restan + 1) : vidaUtil;
    const seAlcanzaAVender = demandaDiaria * vidaRestante;
    const enRiesgo = p.stock - seAlcanzaAVender;
    // Si ya tiene que salir hoy, esa alerta dice lo mismo y más urgente: no se repite como sobrestock.
    const yaPorMalograrse = alertas.some((a) => a.tipo === "deterioro" && a.gravedad === "alta");
    if (enRiesgo >= 1 && !yaPorMalograrse) {
      alertas.push({
        ...base,
        tipo: "sobrestock",
        gravedad: enRiesgo / p.stock >= 0.3 ? "alta" : "media",
        titulo: `Te sobra ${nombre}`,
        detalle: `Tienes ${cajas(p.stock)} y vendes ${cajas(demandaDiaria)} al día: unas ${cajas(Math.ceil(enRiesgo))} no alcanzan a venderse antes de malograrse.`,
        recomendacion: "No compres más hasta que baje. Muévelo con precio o con tus clientes grandes.",
        corto: `${cajas(Math.ceil(enRiesgo))} de más`,
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
        corto: `alcanza para ${dias(coberturaDias)}: compra unas ${cajas(Math.max(1, Math.ceil(demandaDiaria * 4 - p.stock)))}`,
      });
    }
  }

  const partes: PartesProducto = { nombre: p.nombre, variedad: p.variedad, marca: p.marca, seleccion: p.seleccion, calibre: p.calibre, kgPorCaja: p.kgPorCaja };
  return { id: p.id, nombre, detalle: detalleProducto(p), partes, stock: p.stock, demandaDiaria, coberturaDias, edadDias, vidaUtil, origenVida, desgaste, lotes, alertas };
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
  /** Cuántas frutas tienen alguna llegada que tiene que salir hoy. */
  frutasPorMalograrse: number;
  porReponer: number;
  /** Por tipo de alerta: cuántas frutas en total (lo mismo que cuenta su filtro) y cuántas de ellas son para hoy. */
  porTipo: Record<TipoAlerta, { total: number; hoy: number }>;
};

export function resumirInventario(productos: ProductoInventario[], estados: EstadoProducto[]): ResumenInventario {
  const alertas = estados.flatMap((e) => e.alertas);
  return {
    cajas: productos.reduce((s, p) => s + Math.max(0, p.stock), 0),
    valor: Math.round(productos.reduce((s, p) => s + Math.max(0, p.stock) * (p.precioReferencia ?? 0), 0) * 100) / 100,
    alertasAltas: alertas.filter((a) => a.gravedad === "alta").length,
    frutasPorMalograrse: alertas.filter((a) => a.tipo === "deterioro" && a.gravedad === "alta").length,
    porReponer: alertas.filter((a) => a.tipo === "reponer").length,
    porTipo: Object.fromEntries(
      (Object.keys(ORDEN_TIPO) as TipoAlerta[]).map((t) => {
        const deTipo = alertas.filter((a) => a.tipo === t);
        return [t, { total: deTipo.length, hoy: deTipo.filter(esUrgente).length }];
      }),
    ) as ResumenInventario["porTipo"],
  };
}

/** Una tarjeta de «Qué hacer hoy»: una alerta sola, o varias del mismo tipo y la misma urgencia juntas, con una sola recomendación. */
export type GrupoAlertas = {
  clave: string;
  tipo: TipoAlerta;
  gravedad: Gravedad;
  titulo: string;
  /** Con una sola fruta, su detalle; con varias, vacío: cada una dice lo suyo en `alertas[].corto`. */
  detalle: string;
  recomendacion: string;
  alertas: Alerta[];
};

const TITULO_GRUPO: Record<TipoAlerta, Record<Gravedad, (n: number) => string>> = {
  deterioro: { alta: (n) => `${n} frutas tienen que salir hoy`, media: (n) => `${n} frutas salen mañana` },
  reponer: { alta: (n) => `Hay que comprar ${n} frutas hoy`, media: (n) => `Te queda poco de ${n} frutas` },
  sobrestock: { alta: (n) => `Te sobran ${n} frutas`, media: (n) => `Te sobra algo de ${n} frutas` },
  sin_movimiento: { alta: (n) => `${n} frutas no se están vendiendo`, media: (n) => `${n} frutas no se están vendiendo` },
};

// Cuando van juntas, la recomendación no puede llevar la cantidad de una sola fruta («Compra unas 7 cajas…»): esa va en cada fila.
const RECOMENDACION_GRUPO: Record<TipoAlerta, Record<Gravedad, string>> = {
  deterioro: { alta: "Véndelas hoy, antes que lo nuevo. Si no salen, ofrécelas con rebaja.", media: "Ponlas adelante y véndelas primero." },
  reponer: { alta: "Compra hoy lo que dice cada una, para cubrir 4 días.", media: "Compra lo que dice cada una, para cubrir 4 días." },
  sobrestock: {
    alta: "No compres más hasta que bajen. Muévelas con precio o con tus clientes grandes.",
    media: "No compres más hasta que bajen. Muévelas con precio o con tus clientes grandes.",
  },
  sin_movimiento: {
    alta: "Ofrécelas a tus clientes de siempre o con una rebaja; no compres más.",
    media: "Ofrécelas a tus clientes de siempre o con una rebaja; no compres más.",
  },
};

/**
 * Junta las alertas del mismo tipo y la misma urgencia en una tarjeta, en el orden de priorizarAlertas. Con el catálogo real, «Qué hacer
 * hoy» llegó a 10 tarjetas y la misma frase seis veces; «Tu stock» quedaba a 3.6 pantallas (/formidable 2026-11-10).
 */
export function juntarAlertas(alertas: Alerta[]): GrupoAlertas[] {
  const grupos = new Map<string, Alerta[]>();
  for (const a of alertas) {
    const clave = `${a.gravedad}-${a.tipo}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), a]);
  }
  return [...grupos].map(([clave, lista]) => {
    const [a] = lista as [Alerta, ...Alerta[]];
    if (lista.length === 1) return { clave, tipo: a.tipo, gravedad: a.gravedad, titulo: a.titulo, detalle: a.detalle, recomendacion: a.recomendacion, alertas: lista };
    return {
      clave,
      tipo: a.tipo,
      gravedad: a.gravedad,
      titulo: TITULO_GRUPO[a.tipo][a.gravedad](lista.length),
      detalle: "",
      recomendacion: RECOMENDACION_GRUPO[a.tipo][a.gravedad],
      alertas: lista,
    };
  });
}

/**
 * «Qué hacer» en dos grupos: lo que pide algo hoy y lo que puede esperar, cada uno con sus tarjetas (las del mismo tipo, juntas).
 * `avisosQueEsperan` cuenta frutas, no tarjetas: es lo que dice el botón que abre el segundo grupo.
 * Decisión del 16-11, sobre maquetas: el título del grupo dice la urgencia una sola vez. Antes cada tarjeta llevaba una etiqueta
 * roja «Hoy» y la pestaña un número que no cuadraba para quien lo veía por primera vez (2.ª prueba a ciegas, 2026-11-15).
 */
export function porUrgencia(alertas: Alerta[]): { paraHoy: GrupoAlertas[]; puedeEsperar: GrupoAlertas[]; avisosQueEsperan: number } {
  const esperan = alertas.filter((a) => !esUrgente(a));
  return { paraHoy: juntarAlertas(alertas.filter(esUrgente)), puedeEsperar: juntarAlertas(esperan), avisosQueEsperan: esperan.length };
}

/**
 * «Tu stock» por fruta, con lo que NO tiene cajas a la vista: «¿te queda manzana verde premium?» quedaba sin respuesta, porque la lista solo
 * mostraba lo que tenía cajas (prueba a ciegas de /formidable 2026-11-10). Dentro de una fruta con cajas, las variedades sin cajas van en una
 * línea; las frutas que no tienen ninguna caja van todas juntas al final.
 */
export function listaDeStock(estados: EstadoProducto[]): {
  grupos: { fruta: string; cajas: number; conCajas: EstadoProducto[]; sinCajas: string[] }[];
  frutasSinCajas: string[];
} {
  const grupos = agruparPorFruta(estados.map((e) => ({ ...e.partes, estado: e }))).map((g) => g.productos.map((p) => p.estado));
  // Un stock negativo no es «sin cajas»: dice que falta registrar una compra o un conteo, y se muestra como fila (/chaos 2026-11-10).
  const conAlguna = grupos.filter((g) => g.some((e) => e.stock !== 0));
  return {
    grupos: conAlguna.map((g) => ({
      fruta: g[0]!.partes.nombre,
      cajas: g.reduce((s, e) => s + Math.max(0, e.stock), 0),
      conCajas: g.filter((e) => e.stock !== 0),
      // Con el calibre solo si otra de la misma fruta se llama igual: «Roja americana Premium cal. 113».
      sinCajas: g
        .filter((e) => e.stock === 0)
        .map((e) => {
          const titulo = tituloEnGrupo(e.partes);
          const repetido = g.some((o) => o !== e && tituloEnGrupo(o.partes) === titulo);
          return repetido && e.partes.calibre ? `${titulo} cal.\u00a0${e.partes.calibre}` : titulo;
        }),
    })),
    frutasSinCajas: grupos.filter((g) => g.every((e) => e.stock === 0)).map((g) => g[0]!.partes.nombre),
  };
}
