// El teclado del celular: cuándo está abierto y qué cuenta como «algo escrito» que no se debe perder. Lógica pura.

/** Tipos de `<input>` que abren el teclado. Una casilla, un botón o un selector de color no lo abren. */
const TIPOS_CON_TECLADO = new Set(["", "text", "search", "tel", "email", "number", "url", "password", "decimal"]);

export type DatosCampo = { etiqueta: string; tipo?: string | null; soloLectura?: boolean; editable?: boolean };

/** ¿Este elemento abre el teclado al tocarlo? */
export function abreTeclado({ etiqueta, tipo, soloLectura, editable }: DatosCampo): boolean {
  if (soloLectura) return false;
  const t = etiqueta.toLowerCase();
  if (t === "textarea") return true;
  if (t === "input") return TIPOS_CON_TECLADO.has((tipo ?? "").toLowerCase());
  return !!editable;
}

/**
 * ¿Lo que se escribe aquí es un dato que la persona perdería al cerrar? Una búsqueda no: se vuelve a escribir en un segundo y nadie
 * espera que sobreviva. Un nombre, un teléfono, un RUC o un monto sí.
 */
export function cuentaComoEscrito(campo: DatosCampo): boolean {
  if (!abreTeclado(campo)) return false;
  return (campo.tipo ?? "").toLowerCase() !== "search";
}

/** Lo que el teclado le quita a la pantalla para considerarlo abierto. Menos que eso es la barra de direcciones que se esconde. */
const ALTO_MINIMO_TECLADO = 120;

/**
 * El teclado está abierto si hay un campo de escribir con el foco y la pantalla visible se achicó bastante respecto de la más alta que se
 * vio con ese mismo ancho (al girar el celular cambia el ancho y se vuelve a medir).
 */
export function tecladoAbierto({ altoMaximo, altoActual, escribiendo }: { altoMaximo: number; altoActual: number; escribiendo: boolean }): boolean {
  return escribiendo && altoMaximo - altoActual >= ALTO_MINIMO_TECLADO;
}
