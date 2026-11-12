import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { nombreProducto } from "./productos-reglas";
import { analizarProveedores, resumirProveedores, VENTANA_DIAS, type CompraResumida, type FrutaComprada } from "./proveedores-reglas";
import type { Database } from "./supabase/tipos-db";

const DIA_MS = 86_400_000;
/** La antigüedad se mira hasta 6 meses atrás: más que eso no cambia el veredicto. */
const HISTORIA_DIAS = 180;
const PAGINA = 1000;

export type DatosProveedor = {
  id: number;
  nombre: string;
  alias: string[];
  telefono: string | null;
  origen: string | null;
};

/**
 * Lee lo que necesita el apartado Proveedores y lo analiza con lib/proveedores-reglas.ts: los proveedores activos, lo que les
 * debes, una fila por compra de los últimos 6 meses (por páginas: Supabase corta en 1000) y lo comprado por fruta en 90 días.
 */
export async function leerProveedores(supabase: SupabaseClient<Database>, hoy = new Date()) {
  const desdeHistoria = new Date(hoy.getTime() - HISTORIA_DIAS * DIA_MS).toISOString();
  const desdeVentana = new Date(hoy.getTime() - VENTANA_DIAS * DIA_MS).toISOString();

  const leerCompras = async () => {
    const filas: CompraResumida[] = [];
    for (let pagina = 0; ; pagina++) {
      const { data, error } = await supabase
        .from("compras")
        .select("id, proveedor_id, fecha, total")
        .gte("fecha", desdeHistoria)
        .order("id")
        .range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);
      if (error) throw new Error(`No se pudieron leer las compras (${error.code})`);
      filas.push(...data.map((c) => ({ proveedorId: c.proveedor_id, fecha: c.fecha, total: Number(c.total) })));
      if (data.length < PAGINA) return filas;
    }
  };

  const [proveedores, saldos, porFruta, productos, compras] = await Promise.all([
    supabase.from("proveedores").select("id, nombre, alias, telefono, origen").eq("activo", true),
    supabase.from("v_saldo_proveedores").select("proveedor_id, saldo"),
    supabase.rpc("compras_por_proveedor", { p_desde: desdeVentana }),
    supabase.from("productos").select("id, nombre, variedad, marca, seleccion, calibre"),
    leerCompras(),
  ]);
  const error = proveedores.error ?? saldos.error ?? porFruta.error ?? productos.error;
  if (error) throw new Error(`No se pudieron leer los proveedores (${error.code})`);

  const saldoDe = new Map((saldos.data ?? []).map((s) => [s.proveedor_id, Number(s.saldo ?? 0)]));
  const nombreDe = new Map((productos.data ?? []).map((p) => [p.id, { nombre: nombreProducto(p), grupo: p.nombre }]));
  const frutas: FrutaComprada[] = (porFruta.data ?? []).map((f) => ({
    proveedorId: f.proveedor_id,
    productoId: f.producto_id,
    fruta: nombreDe.get(f.producto_id)?.nombre ?? "Fruta",
    grupo: nombreDe.get(f.producto_id)?.grupo ?? "Fruta",
    cajas: Number(f.cajas),
    total: Number(f.total),
    ultimoCosto: Number(f.ultimo_costo),
    costoPromedio: Number(f.costo_promedio),
  }));
  const datos: DatosProveedor[] = proveedores.data ?? [];
  const analisis = analizarProveedores(
    datos.map((p) => ({ id: p.id, nombre: p.nombre, saldo: saldoDe.get(p.id) ?? 0 })),
    compras,
    frutas,
    hoy,
  );
  return { analisis, resumen: resumirProveedores(analisis), datos: new Map(datos.map((p) => [p.id, p])) };
}
