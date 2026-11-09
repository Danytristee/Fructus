// El aviso del día por Web Push: qué dice, quién puede recibirlo y qué direcciones se aceptan. Lógica pura: no importa React ni Supabase.
//
// El problema: el dueño atiende con las manos ocupadas y se olvida de mirar cómo va el día. Un aviso en el teléfono al cerrar le dice
// cuánto vendió, cuánto cobró y cuánto le deben, sin abrir nada; y al tocarlo, abre el cierre del día.
// Mal hecho: avisar con montos que no son los de la pantalla, avisar un día sin ventas «para que no se olvide» (ruido: el dueño aprende a
// ignorarlo), o aceptar cualquier dirección que mande el navegador (el servidor terminaría mandando un POST a donde le diga cualquiera).
import { z } from "zod";

import { formatearHora, formatearSoles } from "./formato";
import { textoVentas, type ResumenHoy } from "./hoy-reglas";

/**
 * La hora de Lima a la que sale el aviso (las 7 p. m.: el puesto ya cerró y la gente que vende de mañana ya descansa).
 * vercel.json la dice en UTC (`0 0 * * *`): lib/push-reglas.test.ts falla si se separan. En Vercel Hobby el cron corre «dentro de la
 * hora», no a la hora exacta: por eso en pantalla se dice «como a las 7 p. m.».
 */
export const HORA_DEL_AVISO_LIMA = 19;

/** Cómo se dice en pantalla: «como a las 7 p. m.». */
export const HORA_DEL_AVISO_TEXTO = `como a las ${formatearHora(HORA_DEL_AVISO_LIMA)}`;

// ---------------------------------------------------------------------------------------------------------------------------------
// Qué direcciones se aceptan
// ---------------------------------------------------------------------------------------------------------------------------------

// Cada navegador manda los avisos por el servicio de su fabricante: Chrome, Edge, Samsung y Opera por el de Google; Firefox por el de
// Mozilla; Safari (iPhone y Mac) por el de Apple; el Edge viejo por el de Windows. Cualquier otra dirección no es un servicio de avisos.
const SERVICIOS_DE_AVISOS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

/**
 * ¿La dirección es de un servicio de avisos conocido? Es la regla que impide que el servidor mande un POST a donde diga una persona
 * con sesión (una dirección de la red interna, por ejemplo). Va aquí, y no solo en la base, porque la tabla la escribe solo el servidor.
 */
export function direccionDeAvisoValida(direccion: string): boolean {
  let url: URL;
  try {
    url = new URL(direccion);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return SERVICIOS_DE_AVISOS.some((servicio) => servicio.test(url.hostname));
}

/** La suscripción tal como la da el navegador (`PushSubscription.toJSON()`): la dirección y las dos claves para cifrar el aviso. */
export const esquemaSuscripcion = z.object({
  endpoint: z
    .string()
    .max(1024)
    .refine(direccionDeAvisoValida, "No es la dirección de un servicio de avisos"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{20,32}$/),
  }),
});
export type SuscripcionPush = z.infer<typeof esquemaSuscripcion>;

// ---------------------------------------------------------------------------------------------------------------------------------
// Qué dice el aviso
// ---------------------------------------------------------------------------------------------------------------------------------

/** Lo que viaja al teléfono. Lo lee public/sw.js: si cambia una llave, cambia allá también (prueba en lib/push/sw.test.ts). */
export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** A dónde lleva el toque. Siempre una ruta de la app. */
  url: string;
  /** Un aviso nuevo con la misma etiqueta reemplaza al anterior en el teléfono en vez de apilarse: si el cron corre dos veces, se ve uno. */
  tag: string;
};

const soles = (monto: number) => formatearSoles(monto).replace(/ /g, " ");

/**
 * El aviso del cierre, con las cifras de resumen_dia() (las mismas de «Hoy»). Un día sin ventas ni abonos no avisa nada: devuelve null.
 * `fecha` es el día de Lima (AAAA-MM-DD).
 */
export function avisoDelDia(r: ResumenHoy, fecha: string): Aviso | null {
  const debe = r.porCobrar > 0 ? `Te deben ${soles(r.porCobrar)}` : "Nadie te debe";
  const tag = `resumen-${fecha}`;
  if (r.numeroVentas > 0) {
    return {
      titulo: `Vendiste ${soles(r.vendido)} hoy`,
      cuerpo: `${textoVentas(r.numeroVentas, r.cajas)} · Cobraste ${soles(r.cobrado)} · ${debe}`,
      url: "/cierre",
      tag,
    };
  }
  if (r.abonos > 0) {
    return { titulo: `Hoy cobraste ${soles(r.abonos)} en abonos`, cuerpo: `No hubo ventas · ${debe}`, url: "/cierre", tag };
  }
  return null;
}

/** El aviso que sale al activarlo: así la persona ve en su teléfono cómo le va a llegar, sin esperar hasta las 7 p. m. */
export function avisoDeActivacion(): Aviso {
  return {
    titulo: "Listo: el aviso del día está activado",
    cuerpo: `Así te va a llegar, todos los días ${HORA_DEL_AVISO_TEXTO}. Tócalo para ver el cierre.`,
    url: "/cierre",
    tag: "aviso-activado",
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Qué dice el servicio de avisos al recibirlo
// ---------------------------------------------------------------------------------------------------------------------------------

export type ResultadoEnvio = { estado: "enviado" } | { estado: "caducada" } | { estado: "fallo"; codigo: string };

/**
 * Cómo se lee la respuesta del servicio de avisos:
 *   - 2xx: lo recibió.
 *   - 404 y 410: esa dirección ya no existe (la persona desinstaló la app, o apagó los avisos en su teléfono): se desactiva sola.
 *   - lo demás (400, 401 o 403 si la clave del servidor no coincide, 413, 429, 5xx): falló esta vez. Se anota el código y no se
 *     desactiva nada: una clave mal puesta no debe apagar los avisos de todos.
 */
export function clasificarRespuesta(estadoHttp: number): ResultadoEnvio {
  if (estadoHttp >= 200 && estadoHttp < 300) return { estado: "enviado" };
  if (estadoHttp === 404 || estadoHttp === 410) return { estado: "caducada" };
  return { estado: "fallo", codigo: `http-${estadoHttp}` };
}
