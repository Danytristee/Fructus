// Quién puede pedirle al servidor que mande el resumen del día: solo el cron de Vercel.
//
// El problema: la ruta del cron está en internet. Sin una guarda, cualquiera podría pedirla mil veces y llenar los teléfonos de avisos.
// Vercel manda `Authorization: Bearer <CRON_SECRET>` cuando la variable existe en el proyecto; aquí se comprueba.
// Mal hecho: comparar con `===` (se puede adivinar el secreto midiendo cuánto tarda la respuesta) o aceptar el pedido si el secreto no
// está configurado (la ruta quedaría abierta justo cuando falta la guarda).
import { createHash, timingSafeEqual } from "node:crypto";

/** Un secreto más corto que esto se adivina; Vercel recomienda al menos 16 caracteres. */
const LARGO_MINIMO_DEL_SECRETO = 16;

export function cronAutorizado(autorizacion: string | null, secreto: string | undefined): boolean {
  if (!secreto || secreto.length < LARGO_MINIMO_DEL_SECRETO || !autorizacion) return false;
  // Se comparan los hashes: tienen el mismo largo siempre, que es lo que pide timingSafeEqual, y no se filtra el largo del secreto.
  const esperado = createHash("sha256").update(`Bearer ${secreto}`).digest();
  const recibido = createHash("sha256").update(autorizacion).digest();
  return timingSafeEqual(esperado, recibido);
}
