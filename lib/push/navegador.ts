// Lo que el navegador deja hacer para recibir el aviso del día (Web Push). Solo se usa desde componentes de cliente
// (components/marco/AvisoDelDia.tsx): toca `navigator`, `Notification` y el service worker.
//
// El problema: pedir permiso y suscribirse son tres pasos del navegador (permiso, service worker, suscripción) y en el iPhone el permiso
// solo se puede pedir dentro del toque de la persona. Mal hecho: esperar una respuesta del servidor antes de pedir el permiso (el
// navegador ya no lo cuenta como un toque) o dejar una suscripción en el teléfono que el servidor no conoce (la pantalla diría
// «Activado» y no llegaría nada).
import { claveParaElNavegador, estadoDelAviso, type EstadoDelAviso } from "../push-reglas";
import { sistemaDe } from "../pwa-reglas";
import { estaInstalada } from "../pwa/instalacion";

const soportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** El service worker de la app ya activo, o null si no hay (en desarrollo no se registra: no se espera algo que no va a llegar). */
async function registroDelServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const registrado = await navigator.serviceWorker.getRegistration("/");
  if (registrado?.active) return registrado;
  if (!registrado && process.env.NODE_ENV !== "production") return null;
  // Recién registrado: se espera a que se active, con tope (con la red mala puede no pasar nunca).
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((listo) => setTimeout(() => listo(null), 5_000))]);
}

/** Qué le toca mostrar a la fila del menú en este teléfono, y la dirección de su suscripción si tiene una. */
export async function leerEstadoDelAviso(): Promise<{ estado: EstadoDelAviso; endpoint: string | null }> {
  const hay = soportado();
  const registro = hay ? await registroDelServiceWorker() : null;
  const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
  const estado = estadoDelAviso({
    sistema: sistemaDe(navigator.userAgent, navigator.maxTouchPoints),
    instalada: estaInstalada(),
    soportado: hay,
    registroDisponible: registro !== null,
    permiso: hay ? Notification.permission : "default",
    suscrita: suscripcion !== null,
  });
  return { estado, endpoint: suscripcion?.endpoint ?? null };
}

export type ResultadoDeSuscribir = { ok: true; suscripcion: PushSubscriptionJSON } | { ok: false; motivo: "bloqueado" | "cerrado" | "no-disponible" | "error" };

const mismaClave = (suscripcion: PushSubscription, clave: Uint8Array) => {
  const actual = suscripcion.options.applicationServerKey;
  if (!actual) return false;
  const bytes = new Uint8Array(actual);
  return bytes.length === clave.length && bytes.every((b, i) => b === clave[i]);
};

/**
 * Pide el permiso y suscribe este teléfono con la clave del servidor. Se llama al principio del toque, sin esperar nada antes: así el
 * navegador cuenta el permiso como pedido por la persona (en el iPhone es obligatorio).
 */
export async function suscribirEsteTelefono(clavePublica: string): Promise<ResultadoDeSuscribir> {
  if (!soportado()) return { ok: false, motivo: "no-disponible" };
  try {
    const permiso = await Notification.requestPermission();
    if (permiso === "denied") return { ok: false, motivo: "bloqueado" };
    if (permiso !== "granted") return { ok: false, motivo: "cerrado" }; // cerró el diálogo sin elegir
    const registro = await registroDelServiceWorker();
    if (!registro) return { ok: false, motivo: "no-disponible" };

    const clave = claveParaElNavegador(clavePublica);
    let suscripcion = await registro.pushManager.getSubscription();
    // Una suscripción hecha con otra clave del servidor (si se cambió) nunca recibiría nada: se rehace.
    if (suscripcion && !mismaClave(suscripcion, clave)) {
      await suscripcion.unsubscribe();
      suscripcion = null;
    }
    suscripcion ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
    return { ok: true, suscripcion: suscripcion.toJSON() };
  } catch (error) {
    console.error("avisos: no se pudo suscribir este teléfono", { error: error instanceof Error ? error.name : "desconocido" });
    return { ok: false, motivo: "error" };
  }
}

/** Quita la suscripción de este teléfono (al apagar, o si el servidor no la pudo guardar y no debe quedar una que él no conoce). */
export async function quitarSuscripcionDeEsteTelefono(): Promise<void> {
  try {
    const registro = soportado() ? await registroDelServiceWorker() : null;
    await (await registro?.pushManager.getSubscription())?.unsubscribe();
  } catch (error) {
    console.error("avisos: no se pudo quitar la suscripción de este teléfono", { error: error instanceof Error ? error.name : "desconocido" });
  }
}
