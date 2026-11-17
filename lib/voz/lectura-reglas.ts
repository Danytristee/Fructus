// Lo que Fructus dice en voz alta antes de guardar una venta en manos libres (ADR-0020, candado 1): lo que se va a guardar, no la
// transcripción. Es la misma tarjeta, dicha. Lógica pura: no importa React ni el sintetizador del navegador (components/voz/hablar.ts).
import { debeDe, faltaDe, frasesFalta, totalDe, type Borrador, type ItemBorrador } from "./confirmar-venta-reglas";
import { MEDIOS_HABLADOS, cajasHabladas, nombreHablado, precioHablado, solesHablados } from "./hablado-reglas";
import { SIN_OPCIONES, faltaDicha, faltaPorPreguntar, preguntaFalta, type OpcionesVenta } from "./pregunta-falta-reglas";

/** Una fruta de la venta, dicha. Con una sola fruta, «a 45 la caja»; con varias, solo «a 45» en cada una, o la lectura se hace eterna. */
const itemHablado = (it: ItemBorrador, uno: boolean) =>
  `${cajasHabladas(it.cantidad)} de ${nombreHablado(it.producto)}, a ${precioHablado(it.precio!)}${uno ? " la caja" : ""}${it.sugerido ? ", precio sugerido" : ""}`;

/** Lo que se va a guardar, dicho: las frutas, el cliente, el total y la rebaja. Sin el pago ni la pregunta del final. */
function resumenHablado(b: Borrador, total: number): string {
  const uno = b.items.length === 1;
  const items = b.items.map((it) => itemHablado(it, uno)).join(", y ");
  const para = b.cliente ? `para ${b.cliente.nombre}` : "para un cliente de paso";
  const rebaja = b.descuento > 0 ? `, con ${solesHablados(b.descuento)} de rebaja` : "";
  return `${items}, ${para}. Total, ${solesHablados(total)}${rebaja}.`;
}

/**
 * La lectura de una venta lista para guardar. null si todavía falta algo (cliente, fruta, precio, si pagó): lo incompleto no se lee,
 * se pide.
 *
 * «10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?»
 */
export function lecturaVenta(b: Borrador): string | null {
  const total = totalDe(b);
  if (faltaDe(b).length > 0 || total === null) return null;
  return `${resumenHablado(b, total)} ${cierreVenta(b)}`;
}

/** Cómo pagó, dicho: «Lo debe», «Pagó con Yape», y con pago al llevar «Pagó 1000 soles con Yape y debe 4000 soles» (ADR-0025). */
function pagoHablado(b: Borrador): string {
  const medio = MEDIOS_HABLADOS[b.medio ?? "efectivo"];
  if (b.condicion !== "credito") return `Pagó ${medio}`;
  return b.pagado ? `Pagó ${solesHablados(b.pagado)} ${medio} y debe ${solesHablados(debeDe(b) ?? 0)}` : "Lo debe";
}

/** El final de la lectura: cómo pagó, el comprobante si se pidió y la pregunta. «Lo debe. Con boleta. ¿Confirmo?» */
function cierreVenta(b: Borrador): string {
  const pago = pagoHablado(b);
  const comprobante = b.comprobante === "boleta" ? " Con boleta." : b.comprobante === "factura" ? " Con factura." : "";
  return `${pago}.${comprobante} ¿Confirmo?`;
}

/**
 * Lo que se dice después de responder («¿Pagó o lo debe?», lo que faltaba) o corregir, con su pregunta, y lo que se lee si pide
 * «repite». La venta se acaba de leer al preguntar: leerla otra vez hacía esperar toda la lectura por una palabra. Basta repetir la
 * respuesta (ADR-0020, candado 4) con lo que todavía no se dijo (el comprobante) y preguntar.
 *   - `sinCambio`: la respuesta a lo que faltaba no cambió nada de la venta. Cuenta como no haberla entendido: se repregunta una vez.
 */
export type Relectura = Guion & { entera: string; sinCambio?: boolean };
/** Lo que se dice tras una corrección hablada, y la venta entera para «repite». */
export type GuionCorregido = Relectura;

/**
 * «Lo debe. ¿Confirmo?». Si con la respuesta falta otro dato que se puede preguntar («lo debe», pero no se sabe quién), la respuesta
 * y la pregunta: «Lo debe. ¿A quién se lo fiaste?». null si falta algo que se elige en la tarjeta.
 */
export function relecturaPago(b: Borrador, opciones: OpcionesVenta = SIN_OPCIONES): Relectura | null {
  const entera = lecturaVenta(b);
  if (entera !== null) return { pregunta: "confirmar", texto: cierreVenta(b), entera };
  const g = guionVenta(b, [], opciones);
  if (g.pregunta !== "falta" || !g.repregunta) return null;
  return { pregunta: "falta", texto: `${pagoHablado(b)}. ${g.repregunta}`, entera: g.texto, repregunta: g.repregunta };
}

const mismoItem = (a: ItemBorrador, b: ItemBorrador) =>
  a.productoId === b.productoId && a.producto === b.producto && a.cantidad === b.cantidad && a.precio === b.precio && a.sugerido === b.sugerido;

/**
 * Qué dice Fructus cuando la persona corrige hablando («no, son ocho cajas»): solo lo que cambió, no la venta entera, que se acaba
 * de leer. «Corregido. 8 cajas de Mango Kent, a 45 la caja. Total, 360 soles. ¿Confirmo?»
 *   - Se dicen las frutas que cambiaron (con sus cajas y su precio), el cliente, la rebaja, el pago y el comprobante, si cambiaron.
 *   - El total se dice siempre que cambie una fruta, la rebaja o el propio total: es el dinero que se va a confirmar.
 *   - Si cambió el número de frutas, se dicen todas: comparar una por una ya no dice nada.
 *   - Con dudas o si falta un dato, igual que al dictar (guionVenta): se mira la tarjeta. Si no cambió nada que se pueda nombrar, se
 *     lee la venta entera: lo que dijo la persona no se reflejó en nada y tiene que oír qué quedó.
 */
/**
 * Qué cambió entre la venta de antes y la corregida. Lo usan la voz (guionCorreccion) y la tarjeta, que marca «corregido» en lo
 * mismo que se dice: así la pantalla y el oído cuentan lo mismo (/formidable 2026-11-17). Las posiciones son de la corregida:
 *   - `frutas`: las que cambiaron en algo (la voz las dice enteras); todas, si cambió cuántas hay;
 *   - `cajas`: las que cambiaron de fruta o de cajas, y las nuevas;
 *   - `precios`: las que cambiaron de precio. La marca va junto a lo que cambió: pegada al precio, con las cajas corregidas, hacía
 *     creer que había cambiado el precio (2.ª prueba ciega).
 */
export type Cambios = {
  frutas: number[];
  cajas: number[];
  precios: number[];
  cliente: boolean;
  rebaja: boolean;
  total: boolean;
  pago: boolean;
  comprobante: boolean;
};

export function cambiosDeCorreccion(antes: Borrador, despues: Borrador): Cambios {
  const mismasFilas = antes.items.length === despues.items.length;
  const previo = (n: number) => (mismasFilas ? antes.items[n]! : null);
  const posiciones = (cambio: (a: ItemBorrador | null, b: ItemBorrador) => boolean) => despues.items.flatMap((it, n) => (cambio(previo(n), it) ? [n] : []));
  return {
    frutas: posiciones((a, b) => a === null || !mismoItem(a, b)),
    cajas: posiciones((a, b) => a === null || a.productoId !== b.productoId || a.producto !== b.producto || a.cantidad !== b.cantidad),
    precios: posiciones((a, b) => a !== null && (a.precio !== b.precio || a.sugerido !== b.sugerido)),
    cliente: (antes.cliente?.id ?? null) !== (despues.cliente?.id ?? null),
    rebaja: antes.descuento !== despues.descuento,
    total: totalDe(antes) !== totalDe(despues),
    // Lo que pagó al llevar también es el pago: cambiar cuánto o con qué se dice (ADR-0025).
    pago:
      despues.condicion !== null &&
      (antes.condicion !== despues.condicion ||
        (despues.condicion === "contado" && antes.medio !== despues.medio) ||
        (despues.condicion === "credito" && ((antes.pagado ?? null) !== (despues.pagado ?? null) || (!!despues.pagado && antes.medio !== despues.medio)))),
    comprobante: antes.comprobante !== despues.comprobante,
  };
}

export function guionCorreccion(antes: Borrador, despues: Borrador, dudas: string[], opciones: OpcionesVenta = SIN_OPCIONES): GuionCorregido {
  const completo = guionVenta(despues, dudas, opciones);
  // La corrección dejó un dato por decir (otro cliente que no se encontró): se dice qué falta y se pregunta.
  if (completo.pregunta === "falta") return { ...completo, texto: `Corregido. ${completo.texto}`, entera: completo.texto };
  const total = totalDe(despues);
  if (completo.pregunta === "ninguna" || total === null) return { ...completo, entera: completo.texto };

  const c = cambiosDeCorreccion(antes, despues);
  const uno = despues.items.length === 1;
  const cambios: string[] = [];
  if (c.frutas.length > 0) cambios.push(`${c.frutas.map((n) => itemHablado(despues.items[n]!, uno)).join(", y ")}.`);
  if (c.cliente) cambios.push(despues.cliente ? `Para ${despues.cliente.nombre}.` : "Para un cliente de paso.");
  if (c.rebaja) cambios.push(despues.descuento > 0 ? `Con ${solesHablados(despues.descuento)} de rebaja.` : "Sin rebaja.");
  if (c.frutas.length > 0 || c.rebaja || c.total) cambios.push(`Total, ${solesHablados(total)}.`);
  if (c.pago) cambios.push(`${pagoHablado(despues)}.`);
  if (c.comprobante) {
    cambios.push(despues.comprobante === "boleta" ? "Con boleta." : despues.comprobante === "factura" ? "Con factura." : "Sin comprobante.");
  }
  if (cambios.length === 0) return { ...completo, entera: completo.texto };
  const pregunta = completo.pregunta === "pago" ? "¿Pagó o lo debe?" : "¿Confirmo?";
  return { pregunta: completo.pregunta, texto: `Corregido. ${cambios.join(" ")} ${pregunta}`, entera: completo.texto };
}

/**
 * Lo que pregunta, y qué espera oír: «confirmo», «pagó» o «lo debe», el dato que falta, o nada (solo avisa y pide el toque).
 * `repregunta`: con un dato que falta, la pregunta sola, para volver a hacerla sin repetir todo lo que falta.
 */
export type Guion = { pregunta: "confirmar" | "pago" | "falta" | "ninguna"; texto: string; repregunta?: string };

/**
 * Qué se dice cuando la persona respondió lo que faltaba («cuarenta»):
 *   - si todavía falta otro dato, «Anotado.» y la pregunta siguiente;
 *   - si quedó lista, «Anotado.» y la venta entera, que nunca se leyó completa (candado 1: se lee lo que se va a guardar), con
 *     «¿Pagó o lo debe?» o «¿Confirmo?»;
 *   - con dudas o si falta algo que se elige en la tarjeta, el aviso de siempre;
 *   - si la respuesta no cambió nada, `sinCambio`: no se entendió y se repregunta.
 */
export function guionCompletado(antes: Borrador, despues: Borrador, dudas: string[], opciones: OpcionesVenta = SIN_OPCIONES): Relectura {
  const g = guionVenta(despues, dudas, opciones);
  const c = cambiosDeCorreccion(antes, despues);
  const cambio = Object.values(c).some((v) => (Array.isArray(v) ? v.length > 0 : v)) || faltaDe(antes).join() !== faltaDe(despues).join();
  if (g.pregunta === "ninguna") return { ...g, entera: g.texto };
  if (!cambio) return { ...g, entera: g.texto, sinCambio: true };
  if (g.pregunta === "falta") return { ...g, texto: `Anotado. ${g.repregunta}`, entera: g.texto };
  return { ...g, texto: `Anotado. ${g.texto}`, entera: g.texto };
}

/**
 * Con dudas del intérprete no se confirma hablando, pero la duda se dice: «Tengo una duda: no sé si dijo 10 o 12 cajas. Revisa la
 * tarjeta y toca Confirmar.» Solo «tengo una duda» obligaba a soltar las cajas para saber cuál (/formidable 2026-11-16). Con varias,
 * la primera y cuántas más.
 */
export function dudaHablada(dudas: string[]): string {
  const primera = (dudas[0] ?? "").trim().replace(/[.。]+$/, "");
  const duda = primera ? `: ${primera.charAt(0).toLowerCase()}${primera.slice(1)}` : "";
  const mas = dudas.length === 2 ? ", y una más" : dudas.length > 2 ? `, y ${dudas.length - 1} más` : "";
  const frase = `Tengo una duda${duda}${mas}`;
  // Una duda que es pregunta ya cierra con «?»: sin otro punto detrás.
  return `${frase}${/[?!]$/.test(frase) ? "" : "."} Revisa la tarjeta y toca Confirmar.`;
}

/**
 * Qué dice Fructus al abrir la tarjeta en manos libres (ADR-0020, candado 4):
 *   - con dudas del intérprete, no se confirma hablando: lo dice y pide el toque;
 *   - si solo falta saber si pagó, lo lee y pregunta «¿Pagó o lo debe?» (nunca se asume contado);
 *   - si falta la fruta, las cajas, el precio o a quién se le fía, dice todo lo que falta y pregunta lo primero: «Falta el precio y si
 *     pagó. ¿A cuánto la caja de Mango Kent?». La respuesta completa la tarjeta (ADR-0027);
 *   - si falta otra cosa (lo que pagó al llevar no cuadra), dice qué falta: se elige en la tarjeta;
 *   - si no falta nada, lee lo que se va a guardar y pregunta «¿Confirmo?».
 * `opciones`: lo dicho y las opciones parecidas de la tarjeta, para leerlas al preguntar.
 */
export function guionVenta(b: Borrador, dudas: string[], opciones: OpcionesVenta = SIN_OPCIONES): Guion {
  if (dudas.length > 0) return { pregunta: "ninguna", texto: dudaHablada(dudas) };
  const falta = faltaDe(b);
  const total = totalDe(b);
  if (falta.length === 0 && total !== null) return { pregunta: "confirmar", texto: lecturaVenta(b)! };
  if (falta.length === 1 && falta[0] === "condicion" && total !== null) return { pregunta: "pago", texto: `${resumenHablado(b, total)} ¿Pagó o lo debe?` };
  const f = faltaPorPreguntar(b, opciones);
  if (f) {
    const pregunta = preguntaFalta(b, f, opciones);
    return { pregunta: "falta", texto: `${faltaDicha(falta)} ${pregunta}`, repregunta: pregunta };
  }
  return { pregunta: "ninguna", texto: `${frasesFalta(falta)} Míralo en la tarjeta.` };
}
