// Dónde vive la cola sin conexión (ADR-0017): IndexedDB del celular, para que sobreviva a una recarga, a cerrar la app
// o a quedarse sin batería. La llave la pone IndexedDB y crece: es el orden en que se guardó. Solo navegador.
// Si el almacenamiento no existe (modo privado), `agregar` devuelve false y la tarjeta dice que no se pudo guardar.
import type { Entrada } from "@/lib/cola-reglas";

const BASE = "fructus-cola";
const ALMACEN = "entradas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, hacer: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = base.transaction(ALMACEN, modo);
      const pedido = hacer(tx.objectStore(ALMACEN));
      let resultado: T;
      pedido.onsuccess = () => (resultado = pedido.result);
      // Se responde al cerrar la transacción, no al terminar el pedido: así lo escrito ya está en disco.
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    base.close();
  }
}

const nombreError = (e: unknown) => (e instanceof Error ? e.name : "desconocido");

/** Guarda una entrada nueva al final de la cola. Devuelve su id, o null si el celular no la pudo guardar. */
export async function agregar(entrada: Omit<Entrada, "id">): Promise<number | null> {
  try {
    return Number(await operar("readwrite", (a) => a.add(entrada)));
  } catch (e) {
    console.error("cola: no se pudo guardar en el celular", { error: nombreError(e) });
    return null;
  }
}

/** Todo lo guardado, en orden. Sin almacenamiento, nada. */
export async function listar(): Promise<Entrada[]> {
  try {
    const todas = (await operar("readonly", (a) => a.getAll())) as Entrada[];
    return todas.sort((x, y) => x.id - y.id);
  } catch {
    return [];
  }
}

/** Reemplaza una entrada (cambió de estado, o un comando «a mano» ya tiene número). */
export async function actualizar(entrada: Entrada): Promise<void> {
  try {
    await operar("readwrite", (a) => a.put(entrada));
  } catch (e) {
    console.error("cola: no se pudo actualizar", { id: entrada.id, error: nombreError(e) });
  }
}

export async function quitar(id: number): Promise<void> {
  try {
    await operar("readwrite", (a) => a.delete(id));
  } catch (e) {
    console.error("cola: no se pudo quitar", { id, error: nombreError(e) });
  }
}
