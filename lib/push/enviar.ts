// Mandar un aviso a un teléfono (Web Push). Lo único que cifra el aviso y habla con el servicio de avisos del navegador.
//
// Recibe la clave del servidor como parámetro y no lee el entorno: quien la lee es lib/push/servidor.ts (que sí es `server-only`).
// Así esta parte se prueba con claves de prueba y sin red.
//
// Cómo funciona, sin magia: `web-push` firma el pedido con la clave del servidor (VAPID) y cifra el aviso con las claves del teléfono
// (RFC 8291); aquí el pedido se manda con `fetch`, con tope de espera y sin seguir redirecciones. Toda llamada externa lleva un tope
// (CLAUDE.md, principio 8): con el servicio de avisos colgado, el cron no puede quedarse esperando.
import { createECDH } from "node:crypto";

import webpush from "web-push";

import { clasificarRespuesta, type Aviso, type ResultadoEnvio } from "../push-reglas";

export type ConfiguracionVapid = {
  /** `mailto:` o `https://`: el servicio de avisos lo pide para saber a quién escribir si el servidor se porta mal. */
  asunto: string;
  clavePublica: string;
  clavePrivada: string;
};

export type DestinoDelAviso = { endpoint: string; clave_p256dh: string; clave_auth: string };

export type OpcionesDeEnvio = {
  /** Cuánto lo guarda el servicio de avisos si el teléfono está apagado. Pasado eso, se descarta: un «tu día» de ayer no sirve. */
  ttlSegundos: number;
  /** Un aviso nuevo con el mismo tema reemplaza al que el servicio de avisos todavía no entregó. Hasta 32 letras, números, «-» y «_». */
  tema?: string;
  topeMs?: number;
  /** Solo para pruebas: manda el pedido aquí en vez de a la dirección del teléfono (el servicio de avisos de mentira de tests/e2e). */
  simulador?: string;
};

const TOPE_POR_DEFECTO_MS = 8_000;

/**
 * ¿La clave pública del servidor es la pareja de su clave privada? Un par cruzado o mal copiado no falla al firmar: el servicio de
 * avisos contesta 401 a todos, todos los días, y nadie se entera. Devuelve el problema, o null si está bien.
 */
export function problemaConLaClaveVapid(v: ConfiguracionVapid): string | null {
  try {
    const publica = Buffer.from(v.clavePublica, "base64url");
    const privada = Buffer.from(v.clavePrivada, "base64url");
    if (publica.length !== 65 || publica[0] !== 4) return "La clave pública de VAPID no tiene la forma esperada (65 bytes, base64url).";
    if (privada.length !== 32) return "La clave privada de VAPID no tiene la forma esperada (32 bytes, base64url).";
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privada);
    if (!ecdh.getPublicKey().equals(publica)) return "La clave pública y la privada de VAPID no son pareja.";
  } catch {
    return "Las claves de VAPID no se pudieron leer.";
  }
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(v.asunto)) return "VAPID_SUBJECT tiene que ser un correo (mailto:...) o una dirección https.";
  return null;
}

/** Manda el aviso y dice cómo salió. Nunca lanza: lo que falle se cuenta como un fallo de este envío. */
export async function enviarAviso(vapid: ConfiguracionVapid, destino: DestinoDelAviso, aviso: Aviso, opciones: OpcionesDeEnvio): Promise<ResultadoEnvio> {
  let pedido: ReturnType<typeof webpush.generateRequestDetails>;
  try {
    pedido = webpush.generateRequestDetails(
      { endpoint: destino.endpoint, keys: { p256dh: destino.clave_p256dh, auth: destino.clave_auth } },
      JSON.stringify(aviso),
      {
        vapidDetails: { subject: vapid.asunto, publicKey: vapid.clavePublica, privateKey: vapid.clavePrivada },
        TTL: opciones.ttlSegundos,
        urgency: "normal",
        topic: opciones.tema,
        contentEncoding: "aes128gcm",
      },
    );
  } catch (e) {
    // Las claves del servidor ya se revisaron antes de mandar: lo que falla aquí son las claves de ese teléfono. No se desactiva por esto:
    // si la causa fuera otra, se apagarían avisos que sí sirven. Se anota y se reintenta mañana.
    return { estado: "fallo", codigo: `cifrado:${e instanceof Error ? e.name : "desconocido"}` };
  }

  // fetch calcula solo el largo del cuerpo.
  const { "Content-Length": _largo, ...cabeceras } = pedido.headers as Record<string, string>;
  void _largo;
  try {
    const respuesta = await fetch(opciones.simulador ?? pedido.endpoint, {
      method: "POST",
      headers: opciones.simulador ? { ...cabeceras, "X-Push-Endpoint": pedido.endpoint } : cabeceras,
      body: pedido.body ? new Uint8Array(pedido.body) : undefined,
      signal: AbortSignal.timeout(opciones.topeMs ?? TOPE_POR_DEFECTO_MS),
      redirect: "error", // un servicio de avisos de verdad no redirige: si lo hace, no se sigue
      cache: "no-store",
    });
    await respuesta.body?.cancel();
    return clasificarRespuesta(respuesta.status);
  } catch (e) {
    return { estado: "fallo", codigo: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "red" };
  }
}
