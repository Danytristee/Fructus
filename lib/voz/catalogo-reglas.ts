// El catálogo del puesto en palabras: lo que el intérprete necesita para no partir «plátano isla del de Chao» en dos
// ni tomar una compra por venta. Se arma desde la base en /api/voz y desde un catálogo fijo en /voz-precision.
// Lógica pura: no importa React ni Supabase.

import { tituloProducto, type PartesProducto } from "../productos-reglas";

export type Catalogo = {
  productos: Pick<PartesProducto, "nombre" | "variedad" | "seleccion">[];
  clientes: { nombre: string; alias: string[] }[];
  proveedores: { nombre: string; alias: string[] }[];
};

// Al intérprete, con la selección: «manzana verde premium», «membrillo 4ta». El calibre no: si hace falta, se elige en la tarjeta.
const producto = (p: Catalogo["productos"][number]) => tituloProducto(p).toLowerCase();
/**
 * A Whisper, cada fruta con las palabras de sus variedades, sin repetir: «ciruela chilena angelino fortuna pink lady». La selección
 * («premium», «4ta») la escribe bien solo, y el prompt tiene que entrar en ~700 caracteres: con el catálogo real, la lista de frases
 * («ciruela chilena angelino, ciruela chilena fortuna…») medía 808 y se comía a los clientes.
 */
function frutas(productos: Catalogo["productos"]): string {
  const porFruta = new Map<string, Set<string>>();
  for (const p of productos) {
    const palabras = porFruta.get(p.nombre.toLowerCase()) ?? new Set<string>();
    for (const w of (p.variedad ?? "").toLowerCase().split(/\s+/).filter(Boolean)) palabras.add(w);
    porFruta.set(p.nombre.toLowerCase(), palabras);
  }
  return [...porFruta].map(([f, palabras]) => [f, ...palabras].join(" ")).join(", ");
}
const persona = (c: { nombre: string; alias: string[] }) => (c.alias.length ? `${c.alias.join(" / ")} (${c.nombre})` : c.nombre);

/** El bloque que va al final del prompt de sistema (docs/interprete-voz.md, sección 2b). */
export function bloqueCatalogo(c: Catalogo): string {
  const lineas = [
    'Lo que hay en este puesto (si lo que dijo calza con uno de estos, cópialo completo: "manzana verde premium", no "manzana";',
    '"el flaco Carlos", no "Carlos"):',
    `- Productos: ${[...new Set(c.productos.map(producto))].join(", ")}.`,
  ];
  if (c.clientes.length) lineas.push(`- Clientes: ${c.clientes.map(persona).join("; ")}.`);
  if (c.proveedores.length) lineas.push(`- Proveedores: ${c.proveedores.map(persona).join("; ")}.`);
  lineas.push('"Me trajo", "llegó" y "compré" son compras a un proveedor, nunca ventas.');
  return lineas.join("\n");
}

/**
 * El prompt de vocabulario para Whisper (docs/interprete-voz.md, sección 1): sesga la ortografía hacia los nombres del
 * puesto. Whisper solo mira los últimos ~224 tokens del prompt, así que se recorta a ~700 caracteres sin partir palabras.
 * Van las frutas primero (son las que más se confunden), después un apodo por cliente y por proveedor.
 */
export function vocabularioWhisper(c: Catalogo, maximo = 700): string {
  const unico = (lista: string[]) => [...new Set(lista)].join(", ");
  const apodo = (x: { nombre: string; alias: string[] }) => x.alias[0] ?? x.nombre;
  const texto = [
    "Venta de fruta por cajas en La Hermelinda, Trujillo.",
    `Frutas: ${frutas(c.productos)}.`,
    c.clientes.length ? `Clientes: ${unico(c.clientes.map(apodo))}.` : "",
    c.proveedores.length ? `Proveedores: ${unico(c.proveedores.map(apodo))}.` : "",
    "Pagos: Yape, Plin, efectivo, transferencia, al crédito, lo debe, abonó, a cuenta.",
  ]
    .filter(Boolean)
    .join(" ");
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo - 1);
  return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[,.\s]+$/, "")}.`;
}
