// El aviso de frescura: cuánto le queda a cada llegada de fruta, contando el calor de cada día. Lógica pura: no importa React ni Supabase.
//
// El problema: «el mango dura 7 días» es cierto a 24°. Una semana de 31° se lo come en 5, y la tabla fija avisaba tarde justo
// cuando más calor hace. Es como el hielo en el mostrador: no dura «dos horas», dura según el sol que le dé.
// Cómo se cuenta: cada día que la caja pasa en el puesto gasta una parte de su vida. A 24° gasta 1/vida; con calor gasta más
// (el doble cada 10 grados) y con fresco, menos. Cuando lo gastado llega a 1, ese fue su último día bueno.
// Mal hecho: contar solo la temperatura de hoy (la caja ya pasó tres días de calor), o inventar la de un día que nadie anotó
// sin decirlo.
import { diaDeLima } from "./formato";
import { diaAnterior, type TemperaturaDia } from "./temperatura-reglas";
import type { EstadoLlegada } from "./vida-util-reglas";

/** A esta temperatura la fruta dura lo que dice su vida útil. */
const TEMPERATURA_NORMAL = 24;
/** Cada cuántos grados de más la fruta se gasta el doble de rápido. */
const DOBLE_CADA = 10;
/** Un día sin lectura se cuenta con la última anotada, si no tiene más de una semana; si no, con la normal. */
const ARRASTRE_MAXIMO_DIAS = 7;
/** Por redondeo, 7 veces 1/7 no siempre da 1 exacto. */
const LLENO = 0.999;
const TOPE_DIAS = 120;
const DIA_MS = 86_400_000;

/** Cuánto más rápido se gasta la fruta a esa temperatura que a la normal: 1 a 24°, 2 a 34°, 0.5 a 14°. */
export const factorCalor = (grados: number): number => 2 ** ((grados - TEMPERATURA_NORMAL) / DOBLE_CADA);

const diaSiguiente = (dia: string, dias = 1) => diaAnterior(dia, -dias);
/** Días enteros de `desde` a `hasta` (negativo si `hasta` es antes). */
export const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA_MS);

/**
 * Con qué temperatura se cuenta un día: la anotada ese día; si falta, la última anotada antes (hasta una semana atrás); si
 * tampoco hay, la normal. `anotada` dice si es de ese mismo día, para que la pantalla no la muestre como si se hubiera medido.
 */
export function temperaturaParaContar(lecturas: readonly TemperaturaDia[], dia: string): { grados: number; anotada: boolean } {
  const ultima = ultimaAnotada(lecturas, dia);
  return ultima === null ? { grados: TEMPERATURA_NORMAL, anotada: false } : { grados: ultima.grados, anotada: ultima.dia === dia };
}

/** La lectura con la que se cuenta ese día: la suya o la última anterior, si no tiene más de una semana. null si no hay ninguna que sirva. */
export function ultimaAnotada(lecturas: readonly TemperaturaDia[], dia: string): TemperaturaDia | null {
  let ultima: TemperaturaDia | null = null;
  for (const l of lecturas) if (l.dia <= dia && (ultima === null || l.dia > ultima.dia)) ultima = l;
  return ultima === null || diasEntre(ultima.dia, dia) > ARRASTRE_MAXIMO_DIAS ? null : ultima;
}

/**
 * Cuántos días hacia atrás se leen las entradas para saber cuándo llegó cada caja (lib/inventario.ts). Ninguna fruta de la tabla
 * aguanta tanto (la que más, 42 días): una caja de antes de eso ya pasó su último día bueno aunque no se sepa cuándo llegó.
 */
export const DIAS_DE_ENTRADAS = 45;

/**
 * Una llegada que todavía tiene cajas en el puesto: qué día de Lima llegó, cuántas quedan de ella y cómo llegó (si se dijo).
 * `antes` marca las cajas que las entradas leídas no cubren: llegaron ese día o antes, y no se sabe cuál.
 */
export type Llegada = { dia: string; cajas: number; estado: EstadoLlegada | null; antes?: true };

/**
 * Las llegadas que todavía están en stock, de la más vieja a la más nueva. Lo primero que entra es lo primero que sale: las
 * entradas más nuevas cubren el stock y la más vieja que hace falta queda a medias. Dos entradas del mismo día que llegaron
 * igual son una llegada; si una llegó verde y otra madura, son dos: no duran lo mismo.
 * Si las entradas conocidas no alcanzan a cubrir el stock, lo que sobra es más viejo de lo que se leyó. Su fecha no se adivina,
 * pero tampoco se calla: con `antesDe` (el día desde el que se leyeron las entradas) sale como una llegada de «ese día o antes».
 * Sin eso, la fruta más vieja del puesto era justo la que no tenía llegada ni aviso (/chaos 2026-11-14).
 */
export function llegadasEnStock(stock: number, entradas: readonly { fecha: string; cantidad: number; estado?: EstadoLlegada | null }[], antesDe?: string): Llegada[] {
  if (stock <= 0) return [];
  const juntas = new Map<string, Llegada>();
  let falta = stock;
  for (const e of [...entradas].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))) {
    if (falta <= 0) break;
    const cajas = Math.min(falta, e.cantidad);
    const dia = diaDeLima(new Date(e.fecha));
    const estado = e.estado ?? null;
    const llave = `${dia} ${estado ?? ""}`;
    juntas.set(llave, { dia, estado, cajas: (juntas.get(llave)?.cajas ?? 0) + cajas });
    falta -= cajas;
  }
  const conocidas = [...juntas.values()].sort((a, b) => (a.dia === b.dia ? 0 : a.dia < b.dia ? -1 : 1));
  const sinCubrir = Math.round(falta * 100) / 100;
  return antesDe && sinCubrir > 0 ? [{ dia: antesDe, cajas: sinCubrir, estado: null, antes: true }, ...conocidas] : conocidas;
}

/** Lo que gastó la caja un día: con qué temperatura se contó y qué parte de su vida se fue. */
type DiaGastado = { dia: string; grados: number; anotada: boolean; gasto: number };

export type Estimacion = {
  /** Desde el día que llegó hasta hoy. */
  dias: DiaGastado[];
  /** De 0 a 1: cuánto de su vida lleva gastado al terminar hoy. */
  gastado: number;
  /** Días buenos que le quedan después de hoy: 0 es «tiene que salir hoy»; 1, «sale mañana». */
  restan: number;
  /** Si su último día bueno ya pasó, hace cuántos días. 0 si todavía no. */
  atraso: number;
  /** Su último día bueno. */
  fin: string;
  /** Su último día bueno si todos los días hubieran sido de temperatura normal. */
  finNormal: string;
  /** Días que le quitó el calor. 0 si el clima no le quitó ninguno. */
  perdidos: number;
};

/**
 * Lleva la cuenta de una llegada. `vida` son los días que aguanta a temperatura normal. Los días que faltan se cuentan con la
 * temperatura de hoy: es la mejor pista de cómo va a estar mañana.
 */
export function estimarLlegada(diaLlegada: string, vida: number, lecturas: readonly TemperaturaDia[], hoy: string): Estimacion {
  const desde = diaLlegada > hoy ? hoy : diaLlegada; // una fecha del futuro es un reloj mal puesto: cuenta desde hoy
  const dias: DiaGastado[] = [];
  let acumulado = 0;
  let fin: string | null = null;
  for (let d = desde; d <= hoy; d = diaSiguiente(d)) {
    const t = temperaturaParaContar(lecturas, d);
    const gasto = factorCalor(t.grados) / vida;
    dias.push({ dia: d, ...t, gasto });
    acumulado += gasto;
    if (fin === null && acumulado >= LLENO) fin = d;
  }
  let restan = 0;
  if (fin === null) {
    const porDia = factorCalor(temperaturaParaContar(lecturas, hoy).grados) / vida;
    for (let a = acumulado; a < LLENO && restan < TOPE_DIAS; a += porDia) restan++;
    fin = diaSiguiente(hoy, restan);
  }
  const finNormal = diaSiguiente(desde, Math.max(1, Math.ceil(vida)) - 1);
  return { dias, gastado: Math.min(1, acumulado), restan, atraso: Math.max(0, diasEntre(fin, hoy)), fin, finNormal, perdidos: Math.max(0, diasEntre(fin, finNormal)) };
}

/**
 * La cuenta de una llegada de la que no se sabe el día (llegó `dia` o antes): no se le hace la cuenta día por día. Ya gastó su
 * vida, pide revisarse hoy y, al ordenar por la que se acaba antes, va primero.
 */
export function llegadaSinFecha(dia: string, hoy: string): Estimacion {
  return { dias: [], gastado: 1, restan: 0, atraso: Math.max(1, diasEntre(dia, hoy)), fin: dia, finNormal: dia, perdidos: 0 };
}

/**
 * «Sigue buena»: alguien miró una llegada que ya había pasado su último día bueno y la encontró vendible (`revisiones_frescura`).
 * `llegadaDia` y `estado` dicen cuál llegada (sin día: las cajas de hace más de 45 días); `dia` es el día de Lima en que se revisó.
 */
export type Revision = { llegadaDia: string | null; estado: EstadoLlegada | null; dia: string };

/** ¿Esa revisión es de esta llegada? */
export const esDeEstaLlegada = (r: Pick<Revision, "llegadaDia" | "estado">, l: Pick<Llegada, "dia" | "estado" | "antes">): boolean =>
  (l.antes ? r.llegadaDia === null : r.llegadaDia === l.dia) && r.estado === l.estado;

/** ¿Ya pasó su último día bueno? Solo a esas se les pregunta si siguen buenas: a la que vence hoy todavía le queda su día. */
export const sePasoDeSuDia = (e: Pick<Estimacion, "restan" | "atraso">): boolean => e.restan === 0 && e.atraso > 0;

/**
 * Lo que cambia en la cuenta de una llegada cuando alguien la revisó HOY y sigue buena: gana un día. Sale de «para hoy», queda
 * como «sale mañana» y mañana se vuelve a preguntar. Lo que gastó no se toca: el calor fue el que fue. La revisión no alarga la
 * vida de la fruta; eso lo decide la estimación de cada noche, que la toma como evidencia (lib/vida-estimada-reglas.ts).
 * Mal hecho sería que el aviso siga igual después del toque (parece que no se guardó) o que desaparezca para siempre.
 */
export function conRevisionDeHoy(e: Estimacion, hoy: string): Estimacion {
  return sePasoDeSuDia(e) ? { ...e, restan: 1, atraso: 0, fin: diaSiguiente(hoy) } : e;
}

const NOMBRE_DEL_DIA = new Intl.DateTimeFormat("es-PE", { weekday: "long", timeZone: "UTC" });
const diaDeSemana = (dia: string) => NOMBRE_DEL_DIA.format(new Date(`${dia}T12:00:00Z`));

/** El día en tres letras, para el pie de un gráfico: «lun», «mié», «sáb». */
export const diaCorto = (dia: string): string => diaDeSemana(dia).slice(0, 3);

/**
 * Cuándo llegó, como se dice en el puesto: «hoy», «ayer», «el lunes» o, si ya pasó una semana, «hace 9 días». Con `antes` (llegó
 * ese día o antes, no se sabe cuál), «hace más de 45 días».
 */
export function cuandoLlego(dia: string, hoy: string, antes = false): string {
  const n = diasEntre(dia, hoy);
  if (antes) return `hace más de ${n} días`;
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : n < 7 ? `el ${diaDeSemana(dia)}` : `hace ${n} días`;
}

/** Lo mismo para nombrar la llegada: «12 cajas del lunes», «de ayer», «de hace 9 días», «de hace más de 45 días». */
export function deCuando(dia: string, hoy: string, antes = false): string {
  const n = diasEntre(dia, hoy);
  if (antes) return `de hace más de ${n} días`;
  return n <= 0 ? "de hoy" : n === 1 ? "de ayer" : n < 7 ? `del ${diaDeSemana(dia)}` : `de hace ${n} días`;
}

/** Hasta cuándo aguanta: «hoy», «mañana» o «el lunes 16». */
export function hastaCuando(dia: string, hoy: string): string {
  const n = diasEntre(hoy, dia);
  return n <= 0 ? "hoy" : n === 1 ? "mañana" : `el ${diaDeSemana(dia)} ${Number(dia.slice(8))}`;
}
