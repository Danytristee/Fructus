// Cuántos días aguanta una caja en el puesto, según qué fruta es y cómo llegó. Lógica pura: no importa React ni Supabase.
//
// El problema: «el mango dura 7 días» depende de en qué punto llegó. Verde aguanta más de una semana; maduro, dos o tres
// días. Con un solo número para los tres, al maduro se le avisa tarde y al verde, antes de tiempo.
// Estos son valores de referencia para la demo, a temperatura normal (24°) y sin cámara de frío. No están medidos en el
// puesto: se ajustan con el dueño, y la estimación de la IA los reemplaza fruta por fruta (lib/vida-estimada-reglas.ts, ADR-0021).

/** Días que aguanta una caja en buen estado, por familia de fruta, si llegó pintona (o si no se dijo cómo llegó). */
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
  caqui: 10,
  membrillo: 20,
  albaricoque: 7,
  cereza: 7,
  durazno: 7,
  tumbo: 7,
  pepino: 7,
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

/** Cómo llegó la fruta. Igual que el tipo `estado_llegada` de la base (sin tilde: es un valor, no un texto de pantalla). */
export const ESTADOS_LLEGADA = ["verde", "pinton", "maduro"] as const;
export type EstadoLlegada = (typeof ESTADOS_LLEGADA)[number];

/** Cómo se dice en pantalla: en el botón («Pintón») y hablando de las cajas («llegaron pintonas»). */
export const NOMBRE_ESTADO: Record<EstadoLlegada, { boton: string; cajas: string }> = {
  verde: { boton: "Verde", cajas: "verdes" },
  pinton: { boton: "Pintón", cajas: "pintonas" },
  maduro: { boton: "Maduro", cajas: "maduras" },
};

/**
 * Las frutas que siguen madurando en la caja: en ellas importa cómo llegaron. A las demás (cítricos, uva, piña, cereza…)
 * no se les pregunta: llegan en su punto y solo se gastan.
 */
const MADURAN_EN_LA_CAJA = new Set(["platano", "mango", "papaya", "palta", "chirimoya", "durazno", "ciruela", "albaricoque", "kiwi", "pera", "caqui", "kaki", "granadilla", "maracuya", "tumbo", "lucuma"]);

export const maduraEnLaCaja = (nombre: string): boolean => MADURAN_EN_LA_CAJA.has(clave(nombre));

/** Cuánto más (o menos) aguanta que una pintona: la verde, bastante más; la madura, la mitad. */
const FACTOR_POR_ESTADO: Record<EstadoLlegada, number> = { verde: 1.4, pinton: 1, maduro: 0.5 };

/**
 * Los días que aguanta una llegada a temperatura normal. `base` es lo que aguanta esa fruta si llega pintona: lo que estimó la
 * IA (lib/vida-estimada-reglas.ts) o, si no hay, la tabla. Si no se dijo cómo llegó, o la fruta no madura en la caja, queda la
 * base. Nunca menos de un día: lo que llega, por lo menos hoy se puede vender.
 */
export function vidaDeLlegada(nombre: string, estado: EstadoLlegada | null | undefined, base = vidaUtilDias(nombre)): number {
  if (!estado || !maduraEnLaCaja(nombre)) return base;
  return Math.max(1, Math.round(base * FACTOR_POR_ESTADO[estado] * 10) / 10);
}
