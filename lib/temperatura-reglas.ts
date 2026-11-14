// La temperatura del puesto: qué acepta la tarjeta, cómo se dice y cuándo una lectura es rara. Lógica pura: no importa React ni Supabase.
//
// El problema: con calor la fruta dura menos, y para saber cuánto menos hay que anotar la temperatura cada día. Se dicta («hoy
// hizo 29 grados») o se anota a mano, y un número mal oído («39» por «29») cambiaría el aviso de qué tiene que salir.
// Mal hecho: aceptar cualquier número, o aceptar sin avisar un salto de 10 grados de un día a otro.

/** Lo que acepta la tarjeta. La base acepta de 0 a 50 (20261114190000_temperatura_diaria): esto es más angosto, para el puesto. */
export const GRADOS_MINIMO = 5;
export const GRADOS_MAXIMO = 45;

/** Si la de hoy se aleja tanto de la de ayer, casi siempre es un dedo que se fue o un número mal oído. Se avisa, no se bloquea. */
const SALTO_RARO = 6;

/** Con qué empieza la tarjeta a mano si nunca se anotó ninguna: el botón necesita un número desde donde moverse. */
export const GRADOS_DE_PARTIDA = 25;

/** La temperatura de un día de Lima (AAAA-MM-DD): la última lectura de ese día (v_temperatura_dia). */
export type TemperaturaDia = { dia: string; grados: number };

const DIA_MS = 86_400_000;

/** El día que está `dias` antes de un día AAAA-MM-DD. Al mediodía UTC: ningún cambio de hora lo corre. */
export function diaAnterior(dia: string, dias = 1): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - dias * DIA_MS).toISOString().slice(0, 10);
}

export const temperaturaValida = (grados: number | null): grados is number =>
  grados !== null && Number.isFinite(grados) && grados >= GRADOS_MINIMO && grados <= GRADOS_MAXIMO;

/** Un decimal como mucho: los termómetros de pared no dan más. */
export const redondearGrados = (grados: number) => Math.round(grados * 10) / 10;

/** «29°», «28.5°»: sin decimales si es entero. */
export const formatearGrados = (grados: number) => `${Number.isInteger(grados) ? grados : grados.toFixed(1)}°`;

/** La temperatura de ese día; null si ese día no se anotó. */
export const temperaturaDe = (lecturas: readonly TemperaturaDia[], dia: string): number | null => lecturas.find((l) => l.dia === dia)?.grados ?? null;

/** Qué le hace esa temperatura a la fruta, en una frase de puesto. `nivel` elige el color; el texto siempre lo dice. */
export function veredictoClima(grados: number): { nivel: "fuerte" | "calor" | "normal" | "fresco"; titulo: string; efecto: string } {
  if (grados >= 30) return { nivel: "fuerte", titulo: "Calor fuerte", efecto: "la fruta dura bastante menos." };
  if (grados >= 27) return { nivel: "calor", titulo: "Hace calor", efecto: "la fruta dura menos." };
  if (grados >= 22) return { nivel: "normal", titulo: "Clima normal", efecto: "la fruta aguanta lo de siempre." };
  return { nivel: "fresco", titulo: "Está fresco", efecto: "la fruta aguanta más." };
}

/** Los últimos `dias` días, hoy al final, cada uno con su temperatura o null si no se anotó: para dibujar la semana. */
export function semanaDeTemperaturas(lecturas: readonly TemperaturaDia[], hoy: string, dias = 7): { dia: string; grados: number | null }[] {
  return Array.from({ length: dias }, (_, n) => {
    const dia = diaAnterior(hoy, dias - 1 - n);
    return { dia, grados: temperaturaDe(lecturas, dia) };
  });
}

/**
 * ¿«Hoy» tiene que pedir la temperatura? Solo si hoy no se anotó y sí se anotó algún día de la semana: es un recordatorio para
 * quien ya tiene la costumbre (y el termómetro), no un aviso que persigue a quien todavía no lo usa.
 */
export const hayQuePedirla = (lecturas: readonly TemperaturaDia[], hoy: string): boolean => temperaturaDe(lecturas, hoy) === null && lecturas.some((l) => l.dia < hoy);

/** ¿La lectura se aleja mucho de la de ayer? Sin la de ayer no hay con qué comparar. */
export const saltoRaro = (grados: number, ayer: number | null): boolean => ayer !== null && Math.abs(grados - ayer) >= SALTO_RARO;
