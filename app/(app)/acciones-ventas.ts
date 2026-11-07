"use server";

import { z } from "zod";

import { motivoLimpio } from "@/lib/anular-reglas";
import { sesion, SIN_SENAL } from "@/lib/voz/accion-servidor";

// Anular una venta (A8). Solo el dueño y el administrador, y siempre con motivo: la base lo exige (`anular_venta(id, motivo)`
// y la restricción `venta_anulada_con_motivo`). Anular devuelve el stock y baja la deuda del cliente en una sola transacción.
// Un reintento tras una respuesta perdida no vuelve a devolver el stock: si la venta ya la anulé yo con ese mismo motivo,
// el pedido ya se cumplió y se responde que está hecho.

const entrada = z.object({ ventaId: z.number().int().positive(), motivo: z.string().max(1000) });

export type ResultadoAnular = { ok: true } | { ok: false; error: string; sinSesion?: true };

const SIN_PERMISO = "Solo el dueño o el administrador pueden anular ventas.";

/** Anula la venta con su motivo. */
export async function anularVenta(datos: z.input<typeof entrada>): Promise<ResultadoAnular> {
  const leido = entrada.safeParse(datos);
  if (!leido.success) return { ok: false, error: "Elige por qué la anulas." };
  const motivo = motivoLimpio(leido.data.motivo);
  if (motivo === null) return { ok: false, error: "Cuenta por qué la anulas, en 3 a 200 letras." };
  const { ventaId } = leido.data;

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y anula la venta otra vez.", sinSesion: true };
  if (!s.permisos.anular) return { ok: false, error: SIN_PERMISO };
  const { supabase } = s;

  const { error } = await supabase.rpc("anular_venta", { p_venta_id: ventaId, p_motivo: motivo });
  if (!error) return { ok: true };

  console.error("ventas: no se pudo anular", { ventaId, codigo: error.code });
  if (error.message.includes("comprobante en SUNAT")) return { ok: false, error: "Esta venta ya tiene comprobante en SUNAT: corresponde una nota de crédito." };
  if (error.message.includes("Solo el dueño") || error.code === "42501") return { ok: false, error: SIN_PERMISO };
  if (error.code === "23514") return { ok: false, error: "Cuenta por qué la anulas, en 3 a 200 letras." };
  if (error.message.includes("ya estaba anulada")) return yaEstabaAnulada(supabase, ventaId, motivo, s.usuarioId);
  return { ok: false, error: SIN_SENAL };
}

type Cliente = NonNullable<Awaited<ReturnType<typeof sesion>>>["supabase"];

/** ¿Ya estaba anulada? Si la anulé yo con este motivo, es el mismo reintento; si fue otra persona u otro motivo, se dice quién y por qué. */
async function yaEstabaAnulada(supabase: Cliente, ventaId: number, motivo: string, usuarioId: string): Promise<ResultadoAnular> {
  const { data, error } = await supabase
    .from("ventas")
    .select("estado, motivo_anulacion, anulada_por, anulador:perfiles!anulada_por(nombre)")
    .eq("id", ventaId)
    .maybeSingle();
  if (error) {
    console.error("ventas: no se pudo mirar si ya estaba anulada", { ventaId, codigo: error.code });
    return { ok: false, error: SIN_SENAL };
  }
  if (!data) return { ok: false, error: "No encontré esa venta: puede que ya no esté en tu historial." };
  if (data.estado === "anulada" && data.anulada_por === usuarioId && data.motivo_anulacion === motivo) return { ok: true };
  const quien = data.anulador?.nombre ? ` por ${data.anulador.nombre}` : "";
  return { ok: false, error: `Esa venta ya estaba anulada${quien}${data.motivo_anulacion ? `: «${data.motivo_anulacion}»` : ""}.` };
}
