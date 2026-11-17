// La respuesta corta después de oír la lectura de una venta (ADR-0020, candado 2): ¿confirma o no? Lógica pura: recibe lo
// que transcribió Whisper y decide. No guarda nada: guardar sigue siendo la misma acción que el toque.

export type Respuesta = "confirmar" | "repetir" | "otra";

/** Solo estas palabras confirman: en el puesto no se dicen por casualidad. Un «sí» suelto no confirma. */
const CONFIRMAN = new Set(["confirmo", "confirma", "confirmado", "correcto", "acepto", "aceptado"]);
/** Lo que se dice alrededor de la palabra sin cambiar lo que significa: «sí, correcto», «ya, confirmo», «todo correcto». */
const RELLENO = new Set(["si", "ya", "ok", "okey", "listo", "dale", "eso", "es", "esta", "todo", "bien", "pues", "oe", "oye", "asi", "perfecto"]);
/** Cualquier negación o pedido de esperar anula la confirmación: «no, correcto no», «espera». */
const NIEGAN = new Set(["no", "nada", "espera", "pera", "cancela", "cancelar", "borra", "descarta", "mal"]);

/** Pedir que lo lea otra vez: con el ruido del puesto, la lectura no siempre se oye (/formidable 2026-11-16). */
const REPITEN = new Set(["repite", "repita", "repiteme", "repitelo", "repitemelo", "repetir"]);
/** «¿Qué?», «¿cómo?», «¿qué dijiste?», «perdón»: solo con estas palabras es pedir que se repita. */
const PREGUNTAN = new Set(["que", "como", "dijiste", "perdon", "disculpa", "eh", "mande"]);

/** Para Whisper: con estas palabras en el prompt las escribe bien aunque se digan rápido. */
export const VOCABULARIO_RESPUESTA = "Confirmo. Correcto. Acepto. No. Sí. Espera. Repite.";

const palabras = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zñ]+/g, " ")
    .split(" ")
    .filter(Boolean);

/**
 * «confirmar» solo si dijo una palabra que confirma y nada más que relleno. Lo que agregue algo («correcto, pero son ocho»)
 * o niegue no confirma: se vuelve a preguntar o se deja para tocar. «Repite», «¿qué?» u «otra vez» piden que se lea de nuevo.
 */
export function clasificarRespuesta(texto: string): Respuesta {
  const p = palabras(texto);
  // Antes que las negaciones: «no te escuché» pide que se repita, no niega la venta.
  if (pideRepetir(p)) return "repetir";
  if (p.some((x) => NIEGAN.has(x))) return "otra";
  const confirma = p.some((x) => CONFIRMAN.has(x));
  const resto = p.filter((x) => !CONFIRMAN.has(x) && !RELLENO.has(x));
  return confirma && resto.length === 0 ? "confirmar" : "otra";
}

/** «Repite», «otra vez», «no te escuché», o una pregunta suelta («¿qué?», «¿cómo?»). Nunca si además confirma. */
function pideRepetir(p: string[]): boolean {
  if (p.some((x) => CONFIRMAN.has(x))) return false;
  if (p.some((x) => REPITEN.has(x))) return true;
  const junto = ` ${p.join(" ")} `;
  if (junto.includes(" otra vez ") || junto.includes(" no escuche ") || junto.includes(" no te escuche ") || junto.includes(" no oi ")) return true;
  return p.length > 0 && p.every((x) => PREGUNTAN.has(x)) && (p.includes("que") || p.includes("como"));
}

/** Para la ruta: lo que pide repetir se resuelve antes que el pago o la corrección, sin llamar al modelo. */
export const pideQueRepita = (texto: string) => pideRepetir(palabras(texto));

/**
 * ¿Vale la pena pedirle al intérprete que corrija la venta con esto? Sí si, además de «no», «sí» o relleno, dijo algo («no, son
 * ocho», «a cuarenta»). Un «no» o un «sí» sueltos no corrigen nada: se repregunta sin gastar una llamada al modelo.
 */
export function pareceCorreccion(texto: string): boolean {
  return palabras(texto).some((x) => !CONFIRMAN.has(x) && !RELLENO.has(x) && !NIEGAN.has(x));
}

/** Lo que se respondió a «¿Pagó o lo debe?». */
export type Pago = { condicion: "contado"; medio: "efectivo" | "yape" | "plin" | "transferencia" } | { condicion: "credito"; medio: null };

/** Para Whisper, cuando se pregunta si pagó. */
export const VOCABULARIO_PAGO = "Pagó. Lo debe. Yape. Plin. Efectivo. Transferencia. Fiado.";

// «Pagué» y «la debo» son de las compras: quien compra es el dueño.
const PAGO = new Set(["pago", "pague", "pagado", "pagada", "contado", "cancelo", "cancelado", "efectivo", "yape", "yapeo", "yapeado", "plin", "transferencia", "transfirio", "deposito"]);
const DEBE = new Set(["debe", "debo", "fiado", "fiada", "fio", "credito", "cuenta", "despues", "luego"]);
const MEDIO: Record<string, Extract<Pago, { condicion: "contado" }>["medio"]> = {
  yape: "yape", yapeo: "yape", yapeado: "yape", plin: "plin", transferencia: "transferencia", transfirio: "transferencia", deposito: "transferencia",
};

// Un monto o una parte en la respuesta («pagó 500», «solo pagó mil», «me dio la mitad») no es «Pagó»: es un pago parcial
// (ADR-0023), y aquí no se adivina cuánto. Se repregunta y la parte se anota en la tarjeta.
const PARTE = new Set(["solo", "nomas", "parte", "mitad", "resto", "dejo", "adelanto", "demas"]);
const CIFRAS = new Set([
  "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "quince", "veinte", "treinta",
  "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa", "cien", "ciento", "doscientos", "trescientos", "cuatrocientos",
  "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos", "mil",
]);
const esParte = (texto: string, p: string[]) => /\d/.test(texto) || p.some((x) => PARTE.has(x) || CIFRAS.has(x));

/**
 * «Pagó», «con Yape», «lo debe», «fiado», «no pagó» → cómo quedó. null si no se entiende o dice las dos cosas: nunca se asume
 * contado (principio 2). «Canceló» es pagó, como se dice en el puesto.
 */
export function clasificarPago(texto: string): Pago | null {
  const p = palabras(texto);
  if (esParte(texto, p)) return null;
  const pago = p.some((x) => PAGO.has(x));
  const debe = p.some((x) => DEBE.has(x));
  const niega = p.includes("no");
  if (debe && !pago && !niega) return { condicion: "credito", medio: null };
  // «No pagó», «todavía no paga»: lo debe. «No debe nada» no se adivina: se pregunta otra vez.
  if (pago && niega && !debe) return { condicion: "credito", medio: null };
  if (pago && !debe && !niega) return { condicion: "contado", medio: p.map((x) => MEDIO[x]).find((m) => m !== undefined) ?? "efectivo" };
  return null;
}
