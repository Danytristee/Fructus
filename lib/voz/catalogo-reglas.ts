// El catálogo del puesto en palabras: lo que el intérprete necesita para no partir «plátano isla del de Chao» en dos
// ni tomar una compra por venta. Se arma desde la base en /api/voz y desde un catálogo fijo en /voz-precision.
// Lógica pura: no importa React ni Supabase.

export type Catalogo = {
  productos: { nombre: string; variedad: string | null }[];
  clientes: { nombre: string; alias: string[] }[];
  proveedores: { nombre: string; alias: string[] }[];
};

const producto = (p: Catalogo["productos"][number]) => [p.nombre, p.variedad].filter(Boolean).join(" ").toLowerCase();
const persona = (c: { nombre: string; alias: string[] }) => (c.alias.length ? `${c.alias.join(" / ")} (${c.nombre})` : c.nombre);

/** El bloque que va al final del prompt de sistema (docs/interprete-voz.md, sección 2b). */
export function bloqueCatalogo(c: Catalogo): string {
  const lineas = [
    'Lo que hay en este puesto (si lo que dijo calza con uno de estos, cópialo completo: "mango edward", no "mango";',
    '"el flaco Carlos", no "Carlos"):',
    `- Productos: ${c.productos.map(producto).join(", ")}.`,
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
    `Frutas: ${unico(c.productos.map(producto))}.`,
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
