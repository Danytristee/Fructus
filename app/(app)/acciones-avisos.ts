"use server";

import { z } from "zod";

import { leerHoraDeCierre } from "@/lib/hora-cierre";
import { HORA_DE_CIERRE_DE_FABRICA, type HoraDeCierre } from "@/lib/hora-cierre-reglas";
import { enviarAviso } from "@/lib/push/enviar";
import { anotarEnLaBase, desactivarSuscripcion, guardarSuscripcion, leerConfiguracionPush } from "@/lib/push/servidor";
import { avisoDeActivacion, esquemaSuscripcion } from "@/lib/push-reglas";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { sesion } from "@/lib/voz/accion-servidor";

// El aviso del día en el teléfono de quien lo pide (ADR-0013). Lo puede activar quien ve el cierre (los cuatro roles): el aviso lleva
// las mismas cifras de «Hoy». La tabla de suscripciones la escribe solo el servidor, con la llave de servicio, después de comprobar aquí
// quién es: la dirección que manda el navegador solo se acepta si es de un servicio de avisos conocido (lib/push-reglas.ts).

export type ResultadoAvisos = { ok: true; prueba: "llego" | "no-se-pudo" } | { ok: false; error: string; sinSesion?: true };

const SIN_SENAL = "No se pudo activar el aviso. Revisa tu señal e inténtalo otra vez.";

/**
 * Guarda este teléfono y le manda un aviso de prueba: así la persona ve en su pantalla cómo le va a llegar, sin esperar hasta la noche.
 * Si el teléfono responde que ya no acepta avisos, no queda activado. Si el aviso de prueba falla por otra causa (el servicio de avisos
 * no responde), el teléfono queda activado y se le dice: mañana se sabrá.
 */
export async function activarAvisos(datos: unknown): Promise<ResultadoAvisos> {
  const leida = esquemaSuscripcion.safeParse(datos);
  if (!leida.success) return { ok: false, error: "No se pudo activar el aviso en este teléfono. Cierra la app y ábrela otra vez." };

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y activa el aviso otra vez.", sinSesion: true };
  if (!s.permisos.cierre) return { ok: false, error: "Tu cuenta no recibe el aviso del día." };

  const configuracion = leerConfiguracionPush();
  if (!configuracion.ok) {
    console.error("push: el aviso del día no está configurado", { faltan: configuracion.faltan, problema: configuracion.problema });
    return { ok: false, error: "El aviso del día todavía no está listo. Avísale a quien administra la app." };
  }
  const { vapid, simulador } = configuracion.configuracion;

  let db: ReturnType<typeof crearClienteServicio>;
  let id: number;
  try {
    db = crearClienteServicio();
    ({ id } = await guardarSuscripcion(db, s.usuarioId, leida.data));
  } catch (e) {
    console.error("push: no se pudo guardar el teléfono", { usuarioId: s.usuarioId, error: e instanceof Error ? e.message : "desconocido" });
    return { ok: false, error: SIN_SENAL };
  }

  // El aviso de prueba dice a qué hora llegará. Si no se puede leer, la de fábrica: es lo que el cron usaría con la base caída.
  const hora = await leerHoraDeCierre(db).catch(() => HORA_DE_CIERRE_DE_FABRICA);
  const { endpoint, keys } = leida.data;
  const resultado = await enviarAviso(vapid, { endpoint, clave_p256dh: keys.p256dh, clave_auth: keys.auth }, avisoDeActivacion(hora), { ttlSegundos: 300, tema: "aviso-activado", simulador });
  try {
    await anotarEnLaBase(db, id, resultado, new Date());
  } catch (e) {
    console.error("push: no se pudo anotar el aviso de prueba", { suscripcionId: id, error: e instanceof Error ? e.message : "desconocido" });
  }
  if (resultado.estado === "caducada") return { ok: false, error: "Tu teléfono no aceptó el aviso. Inténtalo otra vez." };
  if (resultado.estado === "fallo") console.error("push: el aviso de prueba no salió", { suscripcionId: id, codigo: resultado.codigo });
  return { ok: true, prueba: resultado.estado === "enviado" ? "llego" : "no-se-pudo" };
}

const apagar = z.object({ endpoint: z.string().min(1).max(1024) });

/** Apaga el aviso de este teléfono. Solo toca una suscripción de quien lo pide: saber una dirección ajena no alcanza. */
export async function apagarAvisos(datos: unknown): Promise<{ ok: true } | { ok: false; error: string; sinSesion?: true }> {
  const leida = apagar.safeParse(datos);
  if (!leida.success) return { ok: false, error: "No se pudo apagar el aviso en este teléfono." };

  const s = await sesion();
  if (!s) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar y apaga el aviso otra vez.", sinSesion: true };

  try {
    await desactivarSuscripcion(crearClienteServicio(), s.usuarioId, leida.data.endpoint, new Date());
    return { ok: true };
  } catch (e) {
    console.error("push: no se pudo apagar el teléfono", { usuarioId: s.usuarioId, error: e instanceof Error ? e.message : "desconocido" });
    return { ok: false, error: "No se pudo apagar el aviso. Revisa tu señal e inténtalo otra vez." };
  }
}

/**
 * La hora de cierre, para que la fila «Aviso del día» diga a qué hora llega. Se pide al abrir el menú (no en cada pantalla: una consulta
 * más en cada carga, para una fila que casi nadie mira). null si no se pudo leer: la fila lo dice sin hora.
 */
export async function leerHoraDelAviso(): Promise<HoraDeCierre | null> {
  const s = await sesion();
  if (!s || !s.permisos.cierre) return null;
  try {
    return await leerHoraDeCierre(s.supabase);
  } catch (e) {
    console.error("push: no se pudo leer la hora de cierre", { usuarioId: s.usuarioId, error: e instanceof Error ? e.message : "desconocido" });
    return null;
  }
}
