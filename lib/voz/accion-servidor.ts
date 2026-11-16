import "server-only";

// Lo que comparten las server actions de las tarjetas de voz (venta, abono, merma, gasto, compra): la sesión de quien
// toca, marcar el comando como guardado y las frases de error en lenguaje de puesto.
import { permisosDe } from "@/lib/permisos-reglas";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// La frase vive en las reglas de la cola: así la cola sabe que no es un rechazo y lo reintenta (ADR-0019).
export { SIN_SENAL } from "@/lib/cola-reglas";

/** La llave foránea se rompió (23503): el cliente se borró mientras la tarjeta estaba abierta. Reintentar no sirve: hay que elegir otro. */
export const CLIENTE_YA_NO_ESTA = "Ese cliente ya no está en tu cuaderno. Elige a otro.";

/** Lo mismo con lo de una compra: la fruta o el proveedor se borraron mientras la tarjeta estaba abierta. */
export const COMPRA_YA_NO_ESTA = "Una fruta o el proveedor de la compra ya no está. Vuelve a elegirlos.";

/** Lo mismo con la fruta: se desactivó o se borró mientras la tarjeta estaba abierta. */
export const PRODUCTO_YA_NO_ESTA = "Esa fruta ya no está en tu catálogo. Elige otra.";

/**
 * La hora del toque, para lo que llega desde la cola sin conexión (ADR-0019). La base la acepta si es creíble (de 48 h atrás hasta
 * ahora, nunca del futuro) y si no usa la suya: aquí solo se pasa. Sin hora (lo confirmado con señal), la de la base.
 */
export const conFecha = <T extends object>(pedido: T, fecha: string | undefined): T & { fecha?: string } => (fecha ? { ...pedido, fecha } : pedido);

/** «Tu sesión terminó. Vuelve a entrar: el abono te espera en «Hoy».» */
export const sinSesion = (que: string) => `Tu sesión terminó. Vuelve a entrar: ${que} te espera en «Hoy».`;

/**
 * La sesión de quien toca, o null. No redirige como lib/sesion.ts: dentro de una acción, el redirect llegaba al celular
 * como una falla y la tarjeta decía «Revisa tu señal» con la sesión vencida (/chaos 2026-10-29).
 */
export async function sesion() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const { data: perfil, error } = await supabase.from("perfiles").select("rol").eq("id", data.claims.sub).eq("activo", true).maybeSingle();
  if (error) console.error("voz: no se pudo leer el perfil", { usuarioId: data.claims.sub, codigo: error.code });
  return { supabase, usuarioId: data.claims.sub, permisos: permisosDe(perfil?.rol ?? null) };
}

type Cliente = NonNullable<Awaited<ReturnType<typeof sesion>>>["supabase"];

/**
 * Lo que se insertó directo en su tabla (abono, merma, gasto) queda enlazado a su comando: confirmado o corregido, con
 * la latencia medida en el celular (CLAUDE.md, regla 9) y si se confirmó con un toque o hablando. Solo si seguía pendiente: un segundo toque no lo cambia. Si
 * falla, la operación igual vale (el comando solo cuenta distinto en la precisión).
 */
export async function marcarComando(supabase: Cliente, comandoId: number, corregido: boolean, latenciaMs: number, confirmadoPor: "toque" | "voz" = "toque") {
  const { error } = await supabase
    .from("comandos_voz")
    // Cómo se confirmó (ADR-0020) va en la misma fila: el check de la base no deja un «por voz» sin confirmar.
    .update({ resultado: corregido ? "corregido" : "confirmado", latencia_ms: latenciaMs, confirmado_por: confirmadoPor })
    .eq("id", comandoId)
    .eq("resultado", "pendiente");
  if (error) console.error("voz: no se pudo marcar el comando", { comandoId, codigo: error.code });
}

/** Cuánto debe hoy el cliente; null si no se pudo leer (la operación igual se guardó). */
export async function leerSaldo(supabase: Cliente, clienteId: number): Promise<number | null> {
  const { data, error } = await supabase.from("v_saldo_clientes").select("saldo").eq("cliente_id", clienteId).maybeSingle();
  if (error) {
    console.error("voz: no se pudo leer el saldo", { clienteId, codigo: error.code });
    return null;
  }
  return Number(data?.saldo ?? 0);
}

/** Cuántas cajas hay hoy de esa fruta (v_stock); null si no se pudo leer (la operación igual se guardó). */
export async function leerStock(supabase: Cliente, productoId: number): Promise<number | null> {
  const { data, error } = await supabase.from("v_stock").select("stock").eq("producto_id", productoId).maybeSingle();
  if (error) {
    console.error("voz: no se pudo leer el stock", { productoId, codigo: error.code });
    return null;
  }
  return Number(data?.stock ?? 0);
}
