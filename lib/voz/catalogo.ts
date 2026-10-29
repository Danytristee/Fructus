import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/tipos-db";
import type { Catalogo } from "./catalogo-reglas";

// El catálogo cambia poco (un producto o un cliente nuevo al día) y se lee en cada dictado: se guarda 5 minutos por servidor.
// Es el mismo para todos los usuarios con sesión (la RLS los deja leer a todos), así que la caché no mezcla datos de nadie.
const VIGENCIA_MS = 5 * 60_000;
let guardado: { hasta: number; catalogo: Catalogo } | null = null;

/** Productos, clientes y proveedores activos, para el vocabulario de Whisper y para resolver nombres. */
export async function leerCatalogo(supabase: SupabaseClient<Database>): Promise<Catalogo> {
  if (guardado && guardado.hasta > Date.now()) return guardado.catalogo;
  const [productos, clientes, proveedores] = await Promise.all([
    supabase.from("productos").select("nombre, variedad").eq("activo", true).order("nombre"),
    supabase.from("clientes").select("nombre, alias").eq("activo", true).order("nombre"),
    supabase.from("proveedores").select("nombre, alias").eq("activo", true).order("nombre"),
  ]);
  const error = productos.error ?? clientes.error ?? proveedores.error;
  if (error) throw new Error(`No se pudo leer el catálogo (${error.code})`);
  const catalogo: Catalogo = {
    productos: productos.data ?? [],
    clientes: (clientes.data ?? []).map((c) => ({ nombre: c.nombre, alias: c.alias ?? [] })),
    proveedores: (proveedores.data ?? []).map((p) => ({ nombre: p.nombre, alias: p.alias ?? [] })),
  };
  guardado = { hasta: Date.now() + VIGENCIA_MS, catalogo };
  return catalogo;
}
