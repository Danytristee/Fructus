// El envío diario del resumen: lee el día, decide si hay algo que avisar, se lo manda a cada teléfono que lo pidió y anota cómo salió.
//
// Todo lo que toca el mundo (la base y la red) llega como parámetro: aquí vive el orden de las cosas y se prueba sin red ni base.
// Lo cablea lib/push/servidor.ts (server-only) y lo llama app/api/cron/resumen-diario/route.ts.
import { diaDeLima } from "../formato";
import type { ResumenHoy } from "../hoy-reglas";
import { avisoDelDia, type Aviso, type ResultadoEnvio } from "../push-reglas";

/** Un teléfono que pidió el aviso, con lo que hace falta para mandárselo. La dirección es una llave: no se imprime ni se registra. */
export type Destinatario = { id: number; endpoint: string; clave_p256dh: string; clave_auth: string };

export type Dependencias = {
  leerResumen: (fecha: string) => Promise<ResumenHoy>;
  leerDestinatarios: () => Promise<Destinatario[]>;
  enviar: (destino: Destinatario, aviso: Aviso, opciones: { ttlSegundos: number; tema: string }) => Promise<ResultadoEnvio>;
  anotar: (id: number, resultado: ResultadoEnvio, ahora: Date) => Promise<void>;
};

export type Informe = {
  /** El día de Lima que se resumió (AAAA-MM-DD). */
  fecha: string;
  motivo: "enviado" | "sin-movimiento" | "sin-destinatarios";
  destinatarios: number;
  enviados: number;
  caducadas: number;
  fallos: number;
};

/** Cuánto guarda el servicio de avisos un aviso de un teléfono apagado: pasadas 6 horas ya no es «tu día», es ruido de ayer. */
export const TTL_DEL_AVISO_SEGUNDOS = 6 * 3600;

/** Cuántos teléfonos se avisan a la vez: pocos, para no abrir cientos de conexiones y que cada una tenga su tope de espera. */
export const ENVIOS_A_LA_VEZ = 5;

/**
 * Manda el resumen del día de Lima de `ahora`. Si no se puede leer el día, lanza: el cron contesta con error y Vercel lo muestra en
 * rojo (un aviso con cifras inventadas es peor que ninguno). Un envío que falla nunca frena a los demás.
 */
export async function enviarElResumenDelDia(deps: Dependencias, ahora: Date): Promise<Informe> {
  const fecha = diaDeLima(ahora);
  const vacio = { fecha, destinatarios: 0, enviados: 0, caducadas: 0, fallos: 0 };

  const aviso = avisoDelDia(await deps.leerResumen(fecha), fecha);
  if (!aviso) return { ...vacio, motivo: "sin-movimiento" };

  const destinatarios = await deps.leerDestinatarios();
  if (destinatarios.length === 0) return { ...vacio, motivo: "sin-destinatarios" };

  const cuentas = { enviados: 0, caducadas: 0, fallos: 0 };
  const opciones = { ttlSegundos: TTL_DEL_AVISO_SEGUNDOS, tema: aviso.tag };

  const avisarA = async (destino: Destinatario) => {
    let resultado: ResultadoEnvio;
    try {
      resultado = await deps.enviar(destino, aviso, opciones);
    } catch (e) {
      resultado = { estado: "fallo", codigo: `inesperado:${e instanceof Error ? e.name : "desconocido"}` };
    }
    if (resultado.estado === "enviado") cuentas.enviados++;
    else if (resultado.estado === "caducada") cuentas.caducadas++;
    else cuentas.fallos++;
    try {
      await deps.anotar(destino.id, resultado, ahora);
    } catch (e) {
      // No se pudo anotar cómo salió: el aviso ya salió (o no), y eso no cambia. Solo el id, nunca la dirección.
      console.error("push: no se pudo anotar el resultado del envío", { suscripcionId: destino.id, error: e instanceof Error ? e.name : "desconocido" });
    }
  };

  for (let i = 0; i < destinatarios.length; i += ENVIOS_A_LA_VEZ) {
    await Promise.all(destinatarios.slice(i, i + ENVIOS_A_LA_VEZ).map(avisarA));
  }
  return { ...vacio, motivo: "enviado", destinatarios: destinatarios.length, ...cuentas };
}

/**
 * Con qué estado contesta el cron. Rojo (502) solo si había a quién avisar y no salió ni un aviso por fallos: algo está mal (la clave
 * del servidor, el servicio de avisos) y Vercel tiene que mostrarlo. Que las direcciones estén caducadas no es una falla: es la
 * limpieza normal de quien desinstaló la app.
 */
export function estadoHttpDelInforme(informe: Informe): 200 | 502 {
  return informe.motivo === "enviado" && informe.enviados === 0 && informe.fallos > 0 ? 502 : 200;
}
