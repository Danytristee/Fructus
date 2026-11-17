// Cómo se califica una interpretación contra lo esperado en tests/interprete/casos.json (skill /voz-precision).
// Lógica pura: no importa React ni Supabase ni el modelo.

const ARTICULOS = new Set(["el", "la", "los", "las", "de", "del", "al", "a"]);

/** Minúsculas, sin tildes, sin signos, sin artículos. «El de Chao» → ["chao"]. */
export function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p && !ARTICULOS.has(p));
}

/** Un texto coincide si dice todas las palabras importantes de lo esperado («mango kent» ⊆ «mango kent del bueno»). */
function coincideTexto(esperado: string, obtenido: unknown): boolean {
  if (typeof obtenido !== "string") return false;
  const dichas = new Set(palabras(obtenido));
  return palabras(esperado).every((p) => dichas.has(p));
}

/** Compara solo los campos que el caso declara. Devuelve la ruta de cada campo que no coincide. */
export function diferencias(esperado: unknown, obtenido: unknown, ruta = ""): string[] {
  if (esperado === null) return obtenido === null || obtenido === undefined ? [] : [`${ruta}: esperaba null, vino ${JSON.stringify(obtenido)}`];
  if (typeof esperado === "string") return coincideTexto(esperado, obtenido) ? [] : [`${ruta}: esperaba «${esperado}», vino ${JSON.stringify(obtenido)}`];
  if (typeof esperado === "number") return obtenido === esperado ? [] : [`${ruta}: esperaba ${esperado}, vino ${JSON.stringify(obtenido)}`];
  if (Array.isArray(esperado)) {
    if (!Array.isArray(obtenido) || obtenido.length !== esperado.length) return [`${ruta}: esperaba ${esperado.length} elemento(s), vinieron ${Array.isArray(obtenido) ? obtenido.length : 0}`];
    return esperado.flatMap((e, i) => diferencias(e, obtenido[i], `${ruta}[${i}]`));
  }
  if (typeof esperado === "object") {
    const o = (obtenido ?? {}) as Record<string, unknown>;
    return Object.entries(esperado as Record<string, unknown>).flatMap(([k, v]) => diferencias(v, o[k], ruta ? `${ruta}.${k}` : k));
  }
  return [];
}

// Campos de dinero o de pago: si lo esperado es null, el modelo NO puede inventarlos (regla 1 y 2 del prompt).
const CAMPOS_PRUDENTES = new Set(["precio_unitario", "costo_unitario", "condicion", "medio_pago", "descuento_total", "monto", "pago_parcial"]);

/** Los inventos: campos de dinero o pago que debían ser null y vinieron con un valor. Un invento es un fallo grave. */
export function inventos(esperado: unknown, obtenido: unknown, ruta = ""): string[] {
  if (Array.isArray(esperado)) {
    return esperado.flatMap((e, i) => inventos(e, Array.isArray(obtenido) ? obtenido[i] : undefined, `${ruta}[${i}]`));
  }
  if (esperado && typeof esperado === "object") {
    const o = (obtenido ?? {}) as Record<string, unknown>;
    return Object.entries(esperado as Record<string, unknown>).flatMap(([k, v]) => {
      const aqui = ruta ? `${ruta}.${k}` : k;
      if (v === null && CAMPOS_PRUDENTES.has(k)) return o[k] === null || o[k] === undefined ? [] : [`${aqui} = ${JSON.stringify(o[k])}`];
      return inventos(v, o[k], aqui);
    });
  }
  return [];
}

/** Cuántos campos de dinero o pago tiene que dejar en null este caso (para el denominador de la prudencia). */
export function camposPrudentes(esperado: unknown): number {
  if (Array.isArray(esperado)) return esperado.reduce((n: number, e) => n + camposPrudentes(e), 0);
  if (esperado && typeof esperado === "object") {
    return Object.entries(esperado as Record<string, unknown>).reduce(
      (n, [k, v]) => n + (v === null && CAMPOS_PRUDENTES.has(k) ? 1 : camposPrudentes(v)),
      0,
    );
  }
  return 0;
}

// Para el error de transcripción se cuentan todas las palabras, artículos incluidos: se mide el texto, no el sentido.
const todasLasPalabras = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Error por palabras (WER): cuántas palabras hay que cambiar, quitar o poner para ir de lo dicho a lo transcrito, sobre lo dicho. */
export function errorPorPalabras(dicho: string, transcrito: string): number {
  const a = todasLasPalabras(dicho);
  const b = todasLasPalabras(transcrito);
  if (a.length === 0) return b.length === 0 ? 0 : 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j]! + 1, fila[j - 1]! + 1, previa[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previa = fila;
  }
  return previa[b.length]! / a.length;
}

/** El percentil p (0–100) de una lista de milisegundos. */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)]!;
}
