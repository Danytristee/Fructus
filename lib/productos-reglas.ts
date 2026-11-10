// Cómo se nombra y se ordena un producto del puesto (ADR-0016). Un producto es fruta + variedad + marca + selección + calibre: «Membrillo
// 3era» y «Membrillo 4ta» son dos productos con su precio y su stock. Lógica pura: no importa React ni Supabase.

export type PartesProducto = {
  nombre: string;
  variedad: string | null;
  marca?: string | null;
  seleccion?: string | null;
  calibre?: string | null;
  kgPorCaja?: number | null;
};

// «cal. 113» y «18 kg» no se parten al final de una línea: van con espacio duro.
const NBSP = "\u00a0";

const unir = (partes: (string | null | undefined | false)[], separador: string) => partes.filter(Boolean).join(separador);

/** Lo que se lee en grande: «Manzana Verde Premium», «Membrillo 4ta», «Piña». */
export function tituloProducto(p: PartesProducto): string {
  return unir([p.nombre, p.variedad, p.seleccion], " ");
}

/** Dentro del grupo de su fruta, sin repetirla: «Verde Premium», «Chilena Fortuna», «4ta». Si no tiene más, la fruta. */
export function tituloEnGrupo(p: PartesProducto): string {
  const resto = unir([p.variedad, p.seleccion], " ");
  return resto ? resto.charAt(0).toLocaleUpperCase("es") + resto.slice(1) : p.nombre;
}

/**
 * El nombre en una frase, sin que dos productos se confundan: con el calibre cuando lo tiene, porque «Manzana Roja americana Premium» viene
 * en calibre 113 y en 100, con otro precio. La marca va en el detalle: hoy ningún producto se distingue solo por la marca.
 */
export function nombreProducto(p: PartesProducto): string {
  return unir([tituloProducto(p), p.calibre && `cal.${NBSP}${p.calibre}`], " ");
}

/** La línea chica debajo del título: «Nordic · cal. 113 · 20 kg». Vacía si no hay nada que decir. */
export function detalleProducto(p: PartesProducto): string {
  return unir([p.marca, p.calibre && `cal.${NBSP}${p.calibre}`, p.kgPorCaja != null && p.kgPorCaja > 0 && `${p.kgPorCaja.toLocaleString("es-PE")}${NBSP}kg`], " · ");
}

const sinTildes = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

// De la mejor a la de menos. «Comercial» es la selección de batalla: va después de las numeradas.
const RANGO_SELECCION: Record<string, number> = {
  super: 0,
  premium: 1,
  extra: 2,
  elegido: 3,
  "1era": 4,
  "1ra": 4,
  primera: 4,
  "2da": 5,
  segunda: 5,
  "3era": 6,
  "3ra": 6,
  tercera: 6,
  "4ta": 7,
  cuarta: 7,
  "5ta": 8,
  quinta: 8,
  "6ta": 9,
  sexta: 9,
  comercial: 10,
};

/** Sin selección va primero (es el producto «de siempre»); una selección que no conocemos va al final, por orden alfabético. */
export function rangoSeleccion(seleccion: string | null | undefined): number {
  if (!seleccion) return -1;
  return RANGO_SELECCION[sinTildes(seleccion)] ?? 99;
}

const texto = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const comparar = (a: string | null | undefined, b: string | null | undefined) => (!a ? (!b ? 0 : -1) : !b ? 1 : texto.compare(a, b));

/** El orden del catálogo: fruta → variedad → selección (de la mejor a la de menos) → calibre → marca. */
export function compararProductos(a: PartesProducto, b: PartesProducto): number {
  return (
    texto.compare(a.nombre, b.nombre) ||
    comparar(a.variedad, b.variedad) ||
    rangoSeleccion(a.seleccion) - rangoSeleccion(b.seleccion) ||
    comparar(a.seleccion, b.seleccion) ||
    comparar(a.calibre, b.calibre) ||
    comparar(a.marca, b.marca)
  );
}

/** La lista agrupada por fruta, cada grupo en el orden del catálogo: «Manzana» con sus 10, «Pera» con sus 5… */
export function agruparPorFruta<T extends PartesProducto>(productos: T[]): { fruta: string; productos: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const p of [...productos].sort(compararProductos)) {
    const clave = sinTildes(p.nombre);
    grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
  }
  return [...grupos.values()].map((lista) => ({ fruta: lista[0]!.nombre, productos: lista }));
}
