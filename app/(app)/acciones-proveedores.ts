"use server";

import { z } from "zod";

import {
  cambiosDeProveedor,
  NOMBRE_PROVEEDOR_REPETIDO,
  PAGO_MAXIMO,
  validarProveedor,
  type ErroresProveedor,
} from "@/lib/proveedor-reglas";
import { sesion, SIN_SENAL } from "@/lib/voz/accion-servidor";

// Proveedores a mano: darlos de alta, editarlos y anotar lo que les pagas. La RLS es la seguridad (proveedores_gestion,
// pagos_proveedor_*); aquí se dice en lenguaje de puesto.

const borrador = z.object({
  nombre: z.string().max(400),
  apodos: z.string().max(400),
  contacto: z.string().max(200),
  telefono: z.string().max(200),
  ruc: z.string().max(40),
  origen: z.string().max(200),
  direccion: z.string().max(400),
  notas: z.string().max(1000),
});
const entradaProveedor = z.object({ id: z.number().int().positive().nullable(), borrador, inicial: borrador.nullable() });

export type ResultadoGuardarProveedor = { ok: true; id: number } | { ok: false; error: string; errores?: ErroresProveedor; sinSesion?: true };

const SIN_PERMISO_PROVEEDOR = "Solo el dueño o el administrador pueden guardar proveedores.";

/** `id: null` da de alta; con `id`, edita solo lo que cambió. El nombre es único entre los activos (proveedores_nombre_unico). */
export async function guardarProveedor(datos: z.input<typeof entradaProveedor>): Promise<ResultadoGuardarProveedor> {
  const leido = entradaProveedor.safeParse(datos);
  if (!leido.success) return { ok: false, error: "Revisa los datos del proveedor." };
  const validado = validarProveedor(leido.data.borrador);
  if (!validado.ok) return { ok: false, error: "Revisa los datos del proveedor.", errores: validado.errores };
  const { id, inicial } = leido.data;

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y guárdalo otra vez.", sinSesion: true };
  if (!s.permisos.ajustes) return { ok: false, error: SIN_PERMISO_PROVEEDOR };

  if (id !== null) {
    const antes = inicial ? validarProveedor(inicial) : null;
    const cambios = antes?.ok ? cambiosDeProveedor(antes.fila, validado.fila) : validado.fila;
    if (Object.keys(cambios).length === 0) return { ok: true, id };
    // Un update sin permiso o sobre un proveedor que no existe no falla: no toca filas. Por eso se pide lo que tocó.
    const { data, error } = await s.supabase.from("proveedores").update(cambios).eq("id", id).eq("activo", true).select("id");
    if (error) return traducirProveedor(error.code, id);
    if ((data ?? []).length === 0) return { ok: false, error: "No encontré a ese proveedor: puede que lo hayan desactivado." };
    return { ok: true, id };
  }

  const { data, error } = await s.supabase.from("proveedores").insert(validado.fila).select("id").single();
  if (!error && data) return { ok: true, id: data.id };
  if (error?.code === "23505") {
    // ¿Es el mismo proveedor que se guardó hace un momento y cuya respuesta no llegó? Entonces no hay nada que repetir.
    const { data: existente } = await s.supabase
      .from("proveedores")
      .select("id, nombre, alias, contacto, telefono, ruc, origen, direccion, notas")
      .eq("activo", true)
      .ilike("nombre", validado.fila.nombre.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1);
    const igual = existente?.[0];
    if (igual && Object.keys(cambiosDeProveedor(igual, validado.fila)).length === 0) return { ok: true, id: igual.id };
    return { ok: false, error: NOMBRE_PROVEEDOR_REPETIDO, errores: { nombre: NOMBRE_PROVEEDOR_REPETIDO } };
  }
  return traducirProveedor(error?.code, null);
}

function traducirProveedor(codigo: string | undefined, id: number | null): ResultadoGuardarProveedor {
  console.error("proveedores: no se pudo guardar", { proveedorId: id, codigo });
  if (codigo === "42501") return { ok: false, error: SIN_PERMISO_PROVEEDOR };
  if (codigo === "23505") return { ok: false, error: NOMBRE_PROVEEDOR_REPETIDO, errores: { nombre: NOMBRE_PROVEEDOR_REPETIDO } };
  if (codigo === "23514") return { ok: false, error: "Revisa el RUC: tiene 11 números." };
  return { ok: false, error: SIN_SENAL };
}

const entradaPago = z.object({
  comandoId: z.number().int().positive(),
  proveedorId: z.number().int().positive(),
  monto: z.number().positive().max(PAGO_MAXIMO).refine((m) => Math.round(m * 100) === m * 100),
  medio: z.enum(["efectivo", "yape", "plin", "transferencia", "otro"]),
  nota: z.string().trim().max(120).nullable(),
});

export type ResultadoPago = { ok: true; id: number } | { ok: false; error: string; sinSesion?: true };

/**
 * Anota un pago a un proveedor. Va con el comando que la hoja abrió al abrirse (abrirComandoAMano): un doble toque, o un
 * reintento tras una respuesta perdida, choca con pagos_proveedor_uno_por_comando_voz y responde el mismo pago.
 */
export async function registrarPagoProveedor(datos: z.input<typeof entradaPago>): Promise<ResultadoPago> {
  const leido = entradaPago.safeParse(datos);
  if (!leido.success) return { ok: false, error: "Revisa el monto del pago." };
  const { comandoId, proveedorId, monto, medio, nota } = leido.data;

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y anota el pago otra vez.", sinSesion: true };
  if (!s.permisos.registrar) return { ok: false, error: "Tu cuenta no puede registrar pagos." };

  const { data, error } = await s.supabase
    .from("pagos_proveedor")
    .insert({ proveedor_id: proveedorId, monto, medio_pago: medio, nota: nota || null, comando_voz_id: comandoId })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: ya } = await s.supabase.from("pagos_proveedor").select("id").eq("comando_voz_id", comandoId).maybeSingle();
    if (ya) return { ok: true, id: ya.id };
  }
  if (error || !data) {
    console.error("proveedores: no se pudo guardar el pago", { proveedorId, comandoId, codigo: error?.code });
    if (error?.code === "42501") return { ok: false, error: "Tu cuenta no puede registrar pagos." };
    if (error?.code === "23503") return { ok: false, error: "No encontré a ese proveedor." };
    return { ok: false, error: SIN_SENAL };
  }
  await s.supabase.from("comandos_voz").update({ resultado: "confirmado" }).eq("id", comandoId).eq("resultado", "pendiente");
  return { ok: true, id: data.id };
}
