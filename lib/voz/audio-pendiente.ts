// El último audio que no se pudo enviar, guardado en el celular (IndexedDB) para reintentarlo aunque se recargue la
// página (CLAUDE.md, «Sin conexión, se dice»). Uno solo: la cola completa sin conexión es de la fase 2.
// Solo navegador. Si el almacenamiento no existe (modo privado), no se guarda y el botón lo dice igual.

/** `despertar`: empezó con «Hola Fructus»; al reintentar, el servidor vuelve a revisar la frase (actividad 5d). */
export type AudioPendiente = { audio: Blob; duracionMs: number; guardadoEn: number; despertar?: true };

const BASE = "fructus-voz";
const ALMACEN = "pendiente";
const CLAVE = "ultimo";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, hacer: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = hacer(base.transaction(ALMACEN, modo).objectStore(ALMACEN));
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    base.close();
  }
}

/** Guarda el audio; si no se puede, lo dice en la consola y sigue (el aviso en pantalla no depende de esto). */
export async function guardarPendiente(audio: Blob, duracionMs: number, despertar?: true): Promise<boolean> {
  try {
    await operar("readwrite", (a) => a.put({ audio, duracionMs, guardadoEn: Date.now(), ...(despertar && { despertar }) } satisfies AudioPendiente, CLAVE));
    return true;
  } catch (e) {
    console.error("voz: no se pudo guardar el audio pendiente", { error: e instanceof Error ? e.name : "desconocido" });
    return false;
  }
}

export async function leerPendiente(): Promise<AudioPendiente | null> {
  try {
    return ((await operar("readonly", (a) => a.get(CLAVE))) as AudioPendiente | undefined) ?? null;
  } catch {
    return null; // sin almacenamiento no hay nada pendiente que mostrar
  }
}

export async function borrarPendiente(): Promise<void> {
  try {
    await operar("readwrite", (a) => a.delete(CLAVE));
  } catch (e) {
    console.error("voz: no se pudo borrar el audio pendiente", { error: e instanceof Error ? e.name : "desconocido" });
  }
}
