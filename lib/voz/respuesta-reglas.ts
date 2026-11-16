// La respuesta corta después de oír la lectura de una venta (ADR-0020, candado 2): ¿confirma o no? Lógica pura: recibe lo
// que transcribió Whisper y decide. No guarda nada: guardar sigue siendo la misma acción que el toque.

export type Respuesta = "confirmar" | "otra";

/** Solo estas palabras confirman: en el puesto no se dicen por casualidad. Un «sí» suelto no confirma. */
const CONFIRMAN = new Set(["confirmo", "confirma", "confirmado", "correcto", "acepto", "aceptado"]);
/** Lo que se dice alrededor de la palabra sin cambiar lo que significa: «sí, correcto», «ya, confirmo», «todo correcto». */
const RELLENO = new Set(["si", "ya", "ok", "okey", "listo", "dale", "eso", "es", "esta", "todo", "bien", "pues", "oe", "oye", "asi", "perfecto"]);
/** Cualquier negación o pedido de esperar anula la confirmación: «no, correcto no», «espera». */
const NIEGAN = new Set(["no", "nada", "espera", "pera", "cancela", "cancelar", "borra", "descarta", "mal"]);

/** Para Whisper: con estas palabras en el prompt las escribe bien aunque se digan rápido. */
export const VOCABULARIO_RESPUESTA = "Confirmo. Correcto. Acepto. No. Sí. Espera.";

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
 * o niegue no confirma: se vuelve a preguntar o se deja para tocar.
 */
export function clasificarRespuesta(texto: string): Respuesta {
  const p = palabras(texto);
  if (p.some((x) => NIEGAN.has(x))) return "otra";
  const confirma = p.some((x) => CONFIRMAN.has(x));
  const resto = p.filter((x) => !CONFIRMAN.has(x) && !RELLENO.has(x));
  return confirma && resto.length === 0 ? "confirmar" : "otra";
}

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

/**
 * «Pagó», «con Yape», «lo debe», «fiado», «no pagó» → cómo quedó. null si no se entiende o dice las dos cosas: nunca se asume
 * contado (principio 2). «Canceló» es pagó, como se dice en el puesto.
 */
export function clasificarPago(texto: string): Pago | null {
  const p = palabras(texto);
  const pago = p.some((x) => PAGO.has(x));
  const debe = p.some((x) => DEBE.has(x));
  const niega = p.includes("no");
  if (debe && !pago && !niega) return { condicion: "credito", medio: null };
  // «No pagó», «todavía no paga»: lo debe. «No debe nada» no se adivina: se pregunta otra vez.
  if (pago && niega && !debe) return { condicion: "credito", medio: null };
  if (pago && !debe && !niega) return { condicion: "contado", medio: p.map((x) => MEDIO[x]).find((m) => m !== undefined) ?? "efectivo" };
  return null;
}
