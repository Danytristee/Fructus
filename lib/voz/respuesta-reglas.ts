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
