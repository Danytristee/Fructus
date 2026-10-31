import "server-only";

// Lo que dijo la persona → ids de la base: clientes, productos y proveedores, más el precio (o costo) sugerido de cada ítem.
// Dos vueltas en paralelo (búsquedas, después precios), con las RPC buscar_* y ultimo_precio (docs/interprete-voz.md, §5).
// La regla de qué se elige solo y qué se pregunta vive en tarjeta-reglas.ts; aquí solo se consulta.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/tipos-db";
import type { Interpretacion } from "./esquemas";
import { similitud } from "./similitud-reglas";
import { elegir, type Resolucion } from "./tarjeta-reglas";

type Cliente = SupabaseClient<Database>;
type Candidato = Resolucion["clientes"][number];

const nombreProducto = (p: { nombre: string; variedad: string | null }) => [p.nombre, p.variedad].filter(Boolean).join(" ");

async function buscarClientes(supabase: Cliente, q: string | null): Promise<Candidato[]> {
  if (!q) return [];
  const { data, error } = await supabase.rpc("buscar_clientes", { q, limite: 3 });
  if (error) throw new Error(`buscar_clientes (${error.code})`);
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, similitud: c.similitud }));
}

async function buscarProductos(supabase: Cliente, q: string): Promise<Candidato[]> {
  const { data, error } = await supabase.rpc("buscar_productos", { q, limite: 3 });
  if (error) throw new Error(`buscar_productos (${error.code})`);
  return (data ?? []).map((p) => ({ id: p.id, nombre: nombreProducto(p), similitud: p.similitud }));
}

// Los proveedores son pocos y no tienen RPC de búsqueda: se comparan aquí con la misma similitud que pg_trgm.
export async function buscarProveedores(supabase: Cliente, q: string | null): Promise<Candidato[]> {
  if (!q) return [];
  const { data, error } = await supabase.from("proveedores").select("id, nombre, alias").eq("activo", true);
  if (error) throw new Error(`proveedores (${error.code})`);
  return (data ?? [])
    .map((p) => ({ id: p.id, nombre: p.nombre, similitud: Math.max(similitud(q, p.nombre), ...(p.alias ?? []).map((a) => similitud(q, a))) }))
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, 3);
}

/** El precio sugerido: el último que se le cobró a ese cliente por ese producto; sin cliente, el de referencia. */
export async function preciosSugeridos(supabase: Cliente, clienteId: number | null, productos: (number | null)[]): Promise<(number | null)[]> {
  if (clienteId === null) {
    const ids = productos.filter((p): p is number => p !== null);
    if (ids.length === 0) return productos.map(() => null);
    const { data, error } = await supabase.from("productos").select("id, precio_referencia").in("id", ids);
    if (error) throw new Error(`precio_referencia (${error.code})`);
    const porId = new Map((data ?? []).map((p) => [p.id, p.precio_referencia === null ? null : Number(p.precio_referencia)]));
    return productos.map((p) => (p === null ? null : (porId.get(p) ?? null)));
  }
  return Promise.all(
    productos.map(async (p) => {
      if (p === null) return null;
      const { data, error } = await supabase.rpc("ultimo_precio", { p_cliente_id: clienteId, p_producto_id: p });
      if (error) throw new Error(`ultimo_precio (${error.code})`);
      return data === null ? null : Number(data);
    }),
  );
}

/** El costo sugerido de cada fruta: lo que se pagó por caja en su última compra. null si nunca se compró. */
export async function costosSugeridos(supabase: Cliente, productos: (number | null)[]): Promise<(number | null)[]> {
  return Promise.all(
    productos.map(async (p) => {
      if (p === null) return null;
      const { data, error } = await supabase.from("compra_items").select("costo_unitario").eq("producto_id", p).order("id", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(`ultimo_costo (${error.code})`);
      return data === null ? null : Number(data.costo_unitario);
    }),
  );
}

export async function resolver(supabase: Cliente, i: Interpretacion): Promise<Resolucion> {
  const vacia: Resolucion = { clientes: [], proveedores: [], productos: [], precios: [] };
  switch (i.herramienta) {
    case "registrar_venta": {
      const [clientes, ...productos] = await Promise.all([
        buscarClientes(supabase, i.datos.cliente_texto),
        ...i.datos.items.map((it) => buscarProductos(supabase, it.producto_texto)),
      ]);
      // Solo se sugiere precio para lo que se eligió solo: con opciones, la persona elige y recién ahí hay precio.
      const cliente = elegir(i.datos.cliente_texto, clientes).elegido;
      const elegidos = i.datos.items.map((it, n) => elegir(it.producto_texto, productos[n] ?? []).elegido?.id ?? null);
      return { ...vacia, clientes, productos, precios: await preciosSugeridos(supabase, cliente?.id ?? null, elegidos) };
    }
    case "registrar_abono":
      return { ...vacia, clientes: await buscarClientes(supabase, i.datos.cliente_texto) };
    case "registrar_compra": {
      const [proveedores, ...productos] = await Promise.all([
        buscarProveedores(supabase, i.datos.proveedor_texto),
        ...i.datos.items.map((it) => buscarProductos(supabase, it.producto_texto)),
      ]);
      // Igual que el precio en la venta: solo se sugiere costo para la fruta que se eligió sola.
      const elegidos = i.datos.items.map((it, n) => elegir(it.producto_texto, productos[n] ?? []).elegido?.id ?? null);
      return { ...vacia, proveedores, productos, precios: await costosSugeridos(supabase, elegidos) };
    }
    case "registrar_merma":
      return { ...vacia, productos: [await buscarProductos(supabase, i.datos.producto_texto)] };
    case "consultar": {
      const [clientes, productos] = await Promise.all([
        buscarClientes(supabase, i.datos.cliente_texto),
        i.datos.producto_texto ? buscarProductos(supabase, i.datos.producto_texto) : Promise.resolve([]),
      ]);
      return { ...vacia, clientes, productos: [productos] };
    }
    default:
      return vacia;
  }
}
