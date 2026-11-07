// Un monto escrito a mano en la tarjeta de voz: el precio de una caja, un abono, un gasto, el costo de una compra.
// Una sola lectura para todos (una función, una pieza): acepta «45», «47.50», «47,5» y «S/ 45», y nunca adivina. Un
// negativo, más de dos decimales («1,299» ¿es 1.299 o 1299?), cero o un monto absurdo se rechazan con una frase que dice
// cómo escribirlo. Vacío no es error: falta el monto. Lógica pura.

export type LecturaMonto = { ok: true; valor: number } | { ok: false; error: string | null };

type Que = {
  /** Cómo se llama en la tarjeta: «precio», «monto», «costo». */
  nombre: string;
  /** Más que esto es un dedo que se fue (/chaos 2026-10-29). */
  maximo: number;
  /** Lo que sigue a «soles» al decir que es demasiado: «por caja». */
  unidad?: string;
};

export function leerMonto(texto: string, { nombre, maximo, unidad }: Que): LecturaMonto {
  // El «S/» solo se quita al principio: «4s/0» no es 40 (/chaos 2026-11-05). Los espacios se ignoran: «1 299» es 1299.
  const limpio = texto.trim().replace(/^s\/\s*/i, "").replace(/\s/g, "");
  if (limpio === "") return { ok: false, error: null };
  if (limpio.includes("-")) return { ok: false, error: `El ${nombre} no puede ser negativo.` };
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(limpio)) return { ok: false, error: `Escribe el ${nombre} así: 45 o 47.50.` };
  const valor = Number(limpio.replace(",", "."));
  if (valor <= 0) return { ok: false, error: `El ${nombre} tiene que ser más que cero.` };
  if (valor > maximo) return { ok: false, error: `Revisa el ${nombre}: ${valor.toLocaleString("es-PE")} soles${unidad ? ` ${unidad}` : ""} es demasiado.` };
  return { ok: true, valor };
}

/** Un monto que se puede guardar: más que cero, hasta el tope y con dos decimales como máximo (la base rechaza más). */
export function montoValido(valor: number | null, maximo: number): valor is number {
  return valor !== null && valor > 0 && valor <= maximo && Math.round(valor * 100) === valor * 100;
}
