"use server";

import { z } from "zod";

import { cambiosDeCliente, mismaFila, NOMBRE_REPETIDO, PARECIDO_DESDE, validarCliente, type ErroresCliente, type FilaCliente } from "@/lib/cliente-reglas";
import { sesion, SIN_SENAL } from "@/lib/voz/accion-servidor";

// Dar de alta y editar un cliente a mano (A8). Solo el dueño y el administrador (la RLS lo exige: `clientes_gestion`); aquí
// se dice en lenguaje de puesto. El nombre es único entre los clientes activos (índice `clientes_nombre_unico`): un doble
// toque o un reintento tras una respuesta perdida no crean dos «Luis Paredes». Si el que ya existe es idéntico al que se
// quería guardar, es el mismo reintento y se responde con él.

const borrador = z.object({
  nombre: z.string().max(400),
  alias: z.array(z.string().max(200)).max(30),
  telefono: z.string().max(200),
  tipoDocumento: z.enum(["DNI", "RUC"]).nullable(),
  numeroDocumento: z.string().max(100),
  direccion: z.string().max(1000),
  notas: z.string().max(2000),
});

// `inicial` es el borrador tal como se abrió la hoja: sirve para guardar solo lo que cambió (dos personas que editan campos distintos no se pisan).
const entrada = z.object({ id: z.number().int().positive().nullable(), borrador, inicial: borrador.nullable().optional() });

export type ResultadoGuardarCliente =
  | { ok: true; id: number }
  | { ok: false; error: string; errores?: ErroresCliente; sinSesion?: true };

const SIN_PERMISO = "Solo el dueño o el administrador pueden guardar clientes.";

const FILA = "id, nombre, alias, tipo_documento, numero_documento, telefono, direccion, notas";

/** Guarda al cliente: `id: null` lo da de alta; con `id`, edita al que ya existe. */
export async function guardarCliente(datos: z.input<typeof entrada>): Promise<ResultadoGuardarCliente> {
  const leido = entrada.safeParse(datos);
  if (!leido.success) return { ok: false, error: "Revisa los datos del cliente." };
  const validado = validarCliente(leido.data.borrador);
  if (!validado.ok) return { ok: false, error: "Revisa los datos del cliente.", errores: validado.errores };
  const { fila } = validado;
  const { id, inicial } = leido.data;

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y guarda al cliente otra vez.", sinSesion: true };
  if (!s.permisos.ajustes) return { ok: false, error: SIN_PERMISO };
  const { supabase } = s;

  if (id !== null) {
    // Solo lo que cambió. Si lo que se abrió no se puede leer (datos viejos que no pasan las reglas), se guarda todo.
    const original = inicial ? validarCliente(inicial) : null;
    const cambios = original?.ok ? cambiosDeCliente(original.fila, fila) : fila;
    if (Object.keys(cambios).length === 0) return { ok: true, id };
    // Un update sin permiso o sobre un cliente que no existe no falla: no toca filas. Por eso se pide lo que tocó.
    const { data, error } = await supabase.from("clientes").update(cambios).eq("id", id).select("id");
    if (error) return traducir(error.code, id);
    if ((data ?? []).length === 0) return { ok: false, error: "No encontré a ese cliente: puede que ya no esté en tu cuaderno." };
    return { ok: true, id };
  }

  const { data, error } = await supabase.from("clientes").insert(fila).select("id").single();
  if (!error && data) return { ok: true, id: data.id };
  if (error?.code === "23505") {
    // ¿Es el mismo cliente que se guardó hace un momento y cuya respuesta no llegó? Entonces no hay nada que repetir.
    const igual = await yaExisteIgual(supabase, fila);
    if (igual !== null) return { ok: true, id: igual };
    return { ok: false, error: NOMBRE_REPETIDO, errores: { nombre: NOMBRE_REPETIDO } };
  }
  return traducir(error?.code, null);
}

type Cliente = NonNullable<Awaited<ReturnType<typeof sesion>>>["supabase"];

/** El id del cliente activo con ese nombre si es idéntico a `fila`; null si es otra persona que se llama igual. */
async function yaExisteIgual(supabase: Cliente, fila: FilaCliente): Promise<number | null> {
  // `ilike` con el nombre tal cual: se escapan los comodines para que «50%» no busque «50 cualquier cosa».
  const exacto = fila.nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase.from("clientes").select(FILA).eq("activo", true).ilike("nombre", exacto).limit(1);
  if (error) {
    console.error("clientes: no se pudo mirar si ya existía", { codigo: error.code });
    return null;
  }
  const c = data?.[0];
  if (!c) return null;
  const existente: FilaCliente = {
    nombre: c.nombre,
    alias: c.alias,
    tipo_documento: c.tipo_documento === "DNI" || c.tipo_documento === "RUC" ? c.tipo_documento : null,
    numero_documento: c.numero_documento,
    telefono: c.telefono,
    direccion: c.direccion,
    notas: c.notas,
  };
  return mismaFila(existente, fila) ? c.id : null;
}

function traducir(codigo: string | undefined, id: number | null): ResultadoGuardarCliente {
  console.error("clientes: no se pudo guardar", { clienteId: id, codigo });
  if (codigo === "42501") return { ok: false, error: SIN_PERMISO };
  if (codigo === "23505") return { ok: false, error: NOMBRE_REPETIDO, errores: { nombre: NOMBRE_REPETIDO } };
  if (codigo === "23514") return { ok: false, error: "Revisa el documento: el DNI tiene 8 números y el RUC, 11." };
  return { ok: false, error: SIN_SENAL };
}

export type Parecido = { id: number; nombre: string; alias: string[] };

/** A quién se parece el nombre que se está escribiendo (el mismo umbral que usa la voz), para no duplicar a «don Lucho». */
export async function buscarParecidos(nombre: string, excluirId: number | null): Promise<Parecido[] | null> {
  const texto = z.string().trim().min(3).max(80).safeParse(nombre);
  if (!texto.success) return [];
  const s = await sesion();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("buscar_clientes", { q: texto.data, limite: 4 });
  if (error) {
    console.error("clientes: no se pudo buscar parecidos", { codigo: error.code });
    return null;
  }
  return (data ?? [])
    .filter((c) => c.similitud >= PARECIDO_DESDE && c.id !== excluirId)
    .map((c) => ({ id: c.id, nombre: c.nombre, alias: c.alias ?? [] }));
}
