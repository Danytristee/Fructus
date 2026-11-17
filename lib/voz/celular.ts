// Un número al azar que este celular guarda para sí (ADR-0022). Va con lo dictado después de «Hola Fructus»: con él, el servidor sabe
// si dos frases casi iguales vienen de dos celulares que oyeron la misma venta (se toma una sola) o del mismo celular que la repite.
// No dice nada de la persona ni del aparato. Solo navegador.

const CLAVE = "fructus:celular";
let deEstaPagina: string | null = null;

export function idDelCelular(): string {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(CLAVE, nuevo);
    return nuevo;
  } catch {
    // Sin almacenamiento (modo privado): uno mientras dure la página. Repetir la misma frase en este celular igual funciona.
    deEstaPagina ??= crypto.randomUUID();
    return deEstaPagina;
  }
}
