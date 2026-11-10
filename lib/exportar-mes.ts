// Lee de la base todo lo que lleva el Excel de un mes. Va con el cliente de la sesión: lo que alguien no puede ver por su rol, la RLS no se lo da.
//
// El problema: Supabase devuelve como mucho 1000 filas por consulta (max_rows). Un mes con 60 ventas al día pasa de las 1800 ventas, y de las
// ~4000 líneas. Una consulta suelta se cortaría sin avisar y el contador recibiría un mes incompleto con cara de completo.
// Por eso se lee por páginas hasta que la base no devuelva más, y se avanza por lo que llegó de verdad: así funciona aunque el tope del
// proyecto sea otro. Si algún día hay más filas de las razonables, falla con un error: nunca entrega un archivo recortado.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DatosDelMes, RangoDelMes } from "@/lib/exportar-reglas";
import type { Database } from "@/lib/supabase/tipos-db";

type Cliente = SupabaseClient<Database>;

const PAGINA = 1000;
const MAXIMO_DE_PAGINAS = 100; // 100 mil filas por tabla: muy por encima de un mes de 60 ventas al día

/** Falló la lectura de una tabla: lleva cuál y el código de la base, nunca datos del puesto. */
export class ErrorDeLectura extends Error {
  constructor(
    readonly tabla: string,
    readonly codigo: string,
  ) {
    super(`no se pudo leer ${tabla} (${codigo})`);
  }
}

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

/** Lee todas las filas, por páginas. `pedir` recibe el rango (desde y hasta, ambos incluidos) y debe ordenar por `id` para que las páginas no se muevan. */
async function leerTodo<T>(tabla: string, pedir: (desde: number, hasta: number) => Pagina<T>): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
    const { data, error } = await pedir(filas.length, filas.length + PAGINA - 1);
    if (error) throw new ErrorDeLectura(tabla, error.code ?? "sin-codigo");
    if (!data || data.length === 0) return filas;
    filas.push(...data);
  }
  throw new ErrorDeLectura(tabla, "demasiadas-filas");
}

export async function leerDatosDelMes(supabase: Cliente, rango: RangoDelMes): Promise<DatosDelMes> {
  const { desde, hasta } = rango;
  const [clientes, productos, proveedores, ventas, items, abonos, gastos, compras, mermas] = await Promise.all([
    leerTodo("clientes", (a, b) => supabase.from("clientes").select("id, nombre").order("id").range(a, b)),
    leerTodo("productos", (a, b) => supabase.from("productos").select("id, nombre, variedad, seleccion, calibre").order("id").range(a, b)),
    leerTodo("proveedores", (a, b) => supabase.from("proveedores").select("id, nombre").order("id").range(a, b)),
    leerTodo("ventas", (a, b) =>
      supabase
        .from("ventas")
        .select("id, fecha, total, condicion, medio_pago, estado, motivo_anulacion, cliente_id, comprobantes(id, tipo, serie, numero, estado)")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("id")
        .range(a, b),
    ),
    leerTodo("venta_items", (a, b) =>
      supabase
        .from("venta_items")
        .select("id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, ventas!inner(fecha, estado, cliente_id)")
        .gte("ventas.fecha", desde)
        .lt("ventas.fecha", hasta)
        .order("id")
        .range(a, b),
    ),
    leerTodo("abonos", (a, b) =>
      supabase.from("abonos").select("id, fecha, monto, medio_pago, nota, cliente_id").gte("fecha", desde).lt("fecha", hasta).order("id").range(a, b),
    ),
    leerTodo("gastos", (a, b) =>
      supabase.from("gastos").select("id, fecha, monto, medio_pago, categoria, descripcion").gte("fecha", desde).lt("fecha", hasta).order("id").range(a, b),
    ),
    leerTodo("compras", (a, b) =>
      supabase
        .from("compras")
        .select("id, fecha, total, condicion, medio_pago, numero_comprobante, proveedor_id")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("id")
        .range(a, b),
    ),
    leerTodo("movimientos_stock", (a, b) =>
      supabase
        .from("movimientos_stock")
        .select("id, fecha, cantidad, motivo, producto_id")
        .eq("tipo", "merma")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("id")
        .range(a, b),
    ),
  ]);

  // La base devuelve los montos como números; Number() por si alguna vez llegaran como texto («numeric» de Postgres).
  return {
    rango,
    clientes,
    productos,
    proveedores,
    ventas: ventas.map((v) => ({ ...v, total: Number(v.total) })),
    items: items.map(({ ventas: venta, ...i }) => ({
      ...i,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      descuento: Number(i.descuento),
      subtotal: i.subtotal === null ? null : Number(i.subtotal),
      venta,
    })),
    abonos: abonos.map((a) => ({ ...a, monto: Number(a.monto) })),
    gastos: gastos.map((g) => ({ ...g, monto: Number(g.monto) })),
    compras: compras.map((c) => ({ ...c, total: Number(c.total) })),
    mermas: mermas.map((m) => ({ ...m, cantidad: Number(m.cantidad) })),
  };
}
