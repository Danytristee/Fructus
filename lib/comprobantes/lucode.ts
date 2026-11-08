import "server-only";

import { leerConsulta, leerRespuesta, numeroDeComprobante, type ConsultaDelProveedor, type Emisor, type PedidoLucode, type RespuestaDelProveedor } from "./comprobante-reglas";

// El proveedor de comprobantes (Lucode, sandbox de SUNAT). Lo único que habla con la red y lleva la clave: va en el servidor.
// Toda llamada externa lleva un tope de espera (CLAUDE.md, principio 8): sin él, con el proveedor colgado, la persona se quedaría
// mirando «Emitiendo…». Pasado el tope no se sabe si el proveedor recibió el pedido: eso es «sin respuesta», no un fracaso.
// El tope se puede acortar con LUCODE_TOPE_MS (las pruebas lo bajan para no esperar 10 s).
const TOPE_MS = Number(process.env.LUCODE_TOPE_MS) > 0 ? Number(process.env.LUCODE_TOPE_MS) : 10_000;

export type ConfiguracionLucode = { url: string; token: string; emisor: Emisor };

/** Lo que hace falta para emitir, o los nombres (nunca los valores) de lo que falta. */
export function leerConfiguracion(): { ok: true; configuracion: ConfiguracionLucode } | { ok: false; faltan: string[] } {
  const { LUCODE_API_URL: url, LUCODE_TOKEN: token, EMISOR_RUC: ruc, EMISOR_RAZON_SOCIAL: razonSocial } = process.env;
  const faltan = Object.entries({ LUCODE_API_URL: url, LUCODE_TOKEN: token, EMISOR_RUC: ruc, EMISOR_RAZON_SOCIAL: razonSocial })
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);
  if (faltan.length > 0 || !url || !token || !ruc || !razonSocial) return { ok: false, faltan };
  return { ok: true, configuracion: { url: url.replace(/\/+$/, ""), token, emisor: { ruc, razonSocial } } };
}

/** Manda el comprobante al proveedor y dice qué contestó. Nunca lanza: cualquier falla de red es «sin respuesta». */
export async function enviarAlProveedor(configuracion: ConfiguracionLucode, pedido: PedidoLucode): Promise<RespuestaDelProveedor> {
  try {
    const respuesta = await fetch(`${configuracion.url}/comprobantes`, {
      method: "POST",
      headers: { authorization: `Bearer ${configuracion.token}`, "content-type": "application/json" },
      body: JSON.stringify(pedido),
      signal: AbortSignal.timeout(TOPE_MS),
      cache: "no-store",
    });
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    return leerRespuesta(respuesta.status, cuerpo);
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "desconocido";
    // Solo el número del comprobante y el tipo de falla: nada de nombres, documentos ni montos en los registros.
    console.error("comprobantes: el proveedor no respondió", { serie: pedido.serie, numero: pedido.numero, error: nombre });
    return { tipo: "sin-respuesta", motivo: nombre === "TimeoutError" ? "El proveedor no respondió a tiempo" : "No se pudo conectar con el proveedor" };
  }
}

/**
 * Pregunta al proveedor cómo quedó un número que ya le mandamos (cuando no supimos la respuesta, o dijo «ya existe», o quedó
 * «enviado» esperando a SUNAT). Nunca lanza: cualquier falla es «sin respuesta».
 */
export async function consultarEnProveedor(configuracion: ConfiguracionLucode, serie: string, numero: number): Promise<ConsultaDelProveedor> {
  try {
    const respuesta = await fetch(`${configuracion.url}/comprobantes/${numeroDeComprobante(serie, numero)}`, {
      headers: { authorization: `Bearer ${configuracion.token}` },
      signal: AbortSignal.timeout(TOPE_MS),
      cache: "no-store",
    });
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    return leerConsulta(respuesta.status, cuerpo);
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "desconocido";
    console.error("comprobantes: no se pudo consultar al proveedor", { serie, numero, error: nombre });
    return { tipo: "sin-respuesta", motivo: nombre === "TimeoutError" ? "El proveedor no respondió a tiempo" : "No se pudo conectar con el proveedor" };
  }
}
