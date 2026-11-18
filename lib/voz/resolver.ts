import "server-only";

// Lo que dijo la persona → ids de la base: clientes, productos y proveedores, más el precio (o costo) sugerido de cada ítem.
// Dos vueltas en paralelo (búsquedas, después precios), con las RPC buscar_* y ultimo_precio (docs/interprete-voz.md, §5).
// La regla de qué se elige solo y qué se pregunta vive en tarjeta-reglas.ts; aquí solo se consulta.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/tipos-db";
import type { Interpretacion } from "./esquemas";
import { similitud } from "./similitud-reglas";
import { elegir, type Resolucion } from "./tarjeta-reglas";
import { diaDeLima } from "../formato";
import { nombreProducto } from "../productos-reglas";
import { leerTemperaturas } from "../temperatura";
import { temperaturaParaContar } from "../frescura-reglas";
import { diaAnterior, temperaturaDe } from "../temperatura-reglas";

type Cliente = SupabaseClient<Database>;
type Candidato = Resolucion["clientes"][number];

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

/** Las cajas que hay de cada fruta, por id (v_stock). Las que no están activas no vienen. */
export async function leerStock(supabase: Cliente, productos: number[]): Promise<Record<number, number>> {
  if (productos.length === 0) return {};
  const { data, error } = await supabase.from("v_stock").select("producto_id, stock").in("producto_id", productos);
  if (error) throw new Error(`v_stock (${error.code})`);
  return Object.fromEntries((data ?? []).flatMap((x) => (x.producto_id === null ? [] : [[x.producto_id, Number(x.stock ?? 0)]])));
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
      // El stock solo avisa: si no se puede leer, la venta sigue sin aviso (y la tarjeta lo vuelve a pedir).
      const [precios, stock] = await Promise.all([
        preciosSugeridos(supabase, cliente?.id ?? null, elegidos),
        leerStock(supabase, elegidos.filter((id): id is number => id !== null)).catch((e: unknown) => {
          console.error("voz: no se pudo leer el stock", { error: e instanceof Error ? e.message : "desconocido" });
          return undefined;
        }),
      ]);
      return { ...vacia, clientes, productos, precios, ...(stock ? { stock } : {}) };
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
      // La temperatura con la que se cuenta hoy, para que la tarjeta diga cuánto va a aguantar. Si no se puede leer, la compra sigue.
      const [precios, lecturas] = await Promise.all([costosSugeridos(supabase, elegidos), leerTemperaturas(supabase, new Date(), 8).catch(() => [])]);
      return { ...vacia, proveedores, productos, precios, temperaturaHoy: lecturas.length > 0 ? temperaturaParaContar(lecturas, diaDeLima(new Date())).grados : null };
    }
    case "registrar_merma":
      return { ...vacia, productos: [await buscarProductos(supabase, i.datos.producto_texto)] };
    case "registrar_conteo": {
      // El stock de la fruta elegida, para que la tarjeta y la lectura comparen desde el primer cuadro. Si no se puede leer, la
      // tarjeta lo vuelve a pedir al abrirse (y sin señal dice que la necesita).
      const productos = await buscarProductos(supabase, i.datos.producto_texto);
      const elegido = elegir(i.datos.producto_texto, productos).elegido;
      const stock = elegido
        ? await leerStock(supabase, [elegido.id]).catch((e: unknown) => {
            console.error("voz: no se pudo leer el stock del conteo", { error: e instanceof Error ? e.message : "desconocido" });
            return undefined;
          })
        : undefined;
      return { ...vacia, productos: [productos], ...(stock ? { stock } : {}) };
    }
    case "registrar_temperatura": {
      // La de ayer, para que la tarjeta avise si la de hoy se aleja mucho. Con dos días basta.
      const ayer = diaAnterior(diaDeLima(new Date()));
      return { ...vacia, temperaturaAyer: temperaturaDe(await leerTemperaturas(supabase, new Date(), 2), ayer) };
    }
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
