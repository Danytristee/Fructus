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
