import "server-only";

import { diaDeLima } from "../formato";
import { leerResumen, type ResumenHoy } from "../hoy-reglas";
import { leerInventario } from "../inventario";
import { permisosDe } from "../permisos-reglas";
import type { PorSalir, ResultadoEnvio, SuscripcionPush } from "../push-reglas";
import { crearClienteServicio } from "../supabase/servicio";
import { temperaturaDe } from "../temperatura-reglas";
import { problemaConLaClaveVapid, type ConfiguracionVapid } from "./enviar";
import type { Destinatario } from "./resumen-diario";

// Lo que une el aviso del día con el mundo: las claves del servidor y la tabla `suscripciones_push`. Solo corre en el servidor.
// Las claves viven solo aquí (CLAUDE.md, «Seguridad y claves»): la privada de VAPID nunca va al navegador ni a un log. La pública sí es
// pública por diseño, pero igual sale por el servidor (un prop), no por una variable NEXT_PUBLIC_.

export type Servicio = ReturnType<typeof crearClienteServicio>;

export type ConfiguracionPush = {
  vapid: ConfiguracionVapid;
  /** Solo para pruebas (tests/e2e): un servicio de avisos de mentira en esta misma máquina. Cualquier otra dirección se ignora. */
  simulador?: string;
};

/** La configuración lista, o los nombres (nunca los valores) de lo que falta o está mal. */
export function leerConfiguracionPush(): { ok: true; configuracion: ConfiguracionPush } | { ok: false; faltan: string[]; problema?: string } {
  const { VAPID_PUBLIC_KEY: clavePublica, VAPID_PRIVATE_KEY: clavePrivada, VAPID_SUBJECT: asunto, PUSH_SIMULADOR_URL: simulador } = process.env;
  const faltan = Object.entries({ VAPID_PUBLIC_KEY: clavePublica, VAPID_PRIVATE_KEY: clavePrivada, VAPID_SUBJECT: asunto })
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);
  if (faltan.length > 0 || !clavePublica || !clavePrivada || !asunto) return { ok: false, faltan };

  const vapid = { asunto, clavePublica, clavePrivada };
  const problema = problemaConLaClaveVapid(vapid);
  if (problema) return { ok: false, faltan: [], problema };
  return { ok: true, configuracion: { vapid, simulador: simuladorLocal(simulador) } };
}

function simuladorLocal(direccion: string | undefined): string | undefined {
  if (!direccion) return undefined;
  try {
    const url = new URL(direccion);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" ? direccion : undefined;
  } catch {
    return undefined;
  }
}

class ErrorDeBase extends Error {
  constructor(
    readonly tabla: string,
    readonly codigo: string,
  ) {
    super(`push: la base no respondió (${tabla}, ${codigo})`);
    this.name = "ErrorDeBase";
  }
}

/** El resumen del día de Lima, de la misma función que alimenta «Hoy» (resumen_dia). */
export async function leerResumenDeLaBase(db: Servicio, fecha: string): Promise<ResumenHoy> {
  const { data, error } = await db.rpc("resumen_dia", { p_fecha: fecha });
  if (error) throw new ErrorDeBase("resumen_dia", error.code);
  return leerResumen(data);
}

/**
 * Lo que tiene que salir mañana, con la misma cuenta que Stock: las cajas de cada fruta cuyo último día bueno es mañana, hoy, o
 * ya pasó (a la hora de cierre el puesto ya cerró: lo que tenía que salir hoy y sigue ahí, mañana es lo primero).
 */
export async function leerPorSalirDeLaBase(db: Servicio, ahora: Date): Promise<PorSalir> {
  const { estados, lecturas } = await leerInventario(db, ahora);
  const frutas = estados
    .map((e) => ({ nombre: e.nombre, cajas: e.lotes.filter((l) => l.restan <= 1).reduce((s, l) => s + l.cajas, 0) }))
    .filter((f) => f.cajas > 0);
  return { frutas, gradosHoy: temperaturaDe(lecturas, diaDeLima(ahora)) };
}

/** Los teléfonos activos de personas con cuenta activa que pueden ver el cierre: a ellos les corresponde el aviso. */
export async function leerDestinatariosDeLaBase(db: Servicio): Promise<Destinatario[]> {
  const { data, error } = await db
    .from("suscripciones_push")
    .select("id, endpoint, clave_p256dh, clave_auth, perfiles!inner(rol, activo)")
    .eq("activa", true)
    .eq("perfiles.activo", true)
    .order("id")
    .limit(500); // un puesto, a lo más una docena de teléfonos
  if (error) throw new ErrorDeBase("suscripciones_push", error.code);
  return data
    .filter((fila) => permisosDe(fila.perfiles.rol).cierre)
    .map(({ id, endpoint, clave_p256dh, clave_auth }) => ({ id, endpoint, clave_p256dh, clave_auth }));
}

/** Anota cómo salió un envío. Una dirección caducada se desactiva con su fecha: nunca se borra. Solo se guarda el código del error. */
export async function anotarEnLaBase(db: Servicio, id: number, resultado: ResultadoEnvio, ahora: Date): Promise<void> {
  const cambios =
    resultado.estado === "enviado"
      ? { ultimo_aviso_en: ahora.toISOString(), ultimo_error: null }
      : resultado.estado === "caducada"
        ? { activa: false, desactivada_en: ahora.toISOString(), ultimo_error: "caducada" }
        : { ultimo_error: resultado.codigo.slice(0, 100) };
  const { error } = await db.from("suscripciones_push").update(cambios).eq("id", id);
  if (error) throw new ErrorDeBase("suscripciones_push", error.code);
}

/**
 * Guarda el teléfono de quien lo pidió (o lo reactiva). Una dirección es de un solo teléfono: si en él entró otra persona, pasa a ser de
 * ella. Es un upsert con la llave de servicio: con RLS, el update de una fila ajena no fallaría, solo no tocaría nada.
 */
export async function guardarSuscripcion(db: Servicio, usuarioId: string, s: SuscripcionPush): Promise<{ id: number }> {
  const { data, error } = await db
    .from("suscripciones_push")
    .upsert(
      { usuario_id: usuarioId, endpoint: s.endpoint, clave_p256dh: s.keys.p256dh, clave_auth: s.keys.auth, activa: true, desactivada_en: null, ultimo_error: null },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();
  if (error) throw new ErrorDeBase("suscripciones_push", error.code);
  return data;
}

/** Apaga el aviso de un teléfono de esa persona. Solo toca una suscripción suya: saber una dirección ajena no alcanza para apagarla. */
export async function desactivarSuscripcion(db: Servicio, usuarioId: string, endpoint: string, ahora: Date): Promise<void> {
  const { error } = await db
    .from("suscripciones_push")
    .update({ activa: false, desactivada_en: ahora.toISOString() })
    .eq("endpoint", endpoint)
    .eq("usuario_id", usuarioId)
    .eq("activa", true);
  if (error) throw new ErrorDeBase("suscripciones_push", error.code);
}

/** La clave pública de VAPID para que el navegador pueda suscribirse, o null si el aviso del día no está listo en este servidor (no se ofrece). */
export function clavePublicaParaElNavegador(): string | null {
  const configuracion = leerConfiguracionPush();
  return configuracion.ok ? configuracion.configuracion.vapid.clavePublica : null;
}
