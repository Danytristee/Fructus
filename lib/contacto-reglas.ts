// Cómo hablarle a un cliente o a un proveedor con un toque: llamarlo o abrir WhatsApp con un mensaje ya escrito, que la persona lee,
// cambia si quiere y manda ella. WhatsApp se abre con un enlace: su API cobra por los mensajes (CLAUDE.md, «No se usa»). Lógica pura.
import { formatearSoles } from "./formato";

/** `tel:` para llamar con un toque; null si el número no sirve (vacío o con letras). */
export function enlaceDeLlamada(telefono: string | null): string | null {
  const limpio = (telefono ?? "").replace(/[\s\-().]/g, "");
  return /^\+?\d{6,15}$/.test(limpio) ? `tel:${limpio}` : null;
}

/**
 * Un enlace para abrir WhatsApp con ese número (no manda nada solo: la persona escribe y envía). Un celular peruano de 9
 * dígitos que empieza con 9 se completa con el 51; con código de país, se respeta. null si el número no sirve.
 */
export function enlaceWhatsApp(telefono: string | null, mensaje?: string): string | null {
  const limpio = (telefono ?? "").replace(/[\s\-().]/g, "");
  let numero: string | null = null;
  if (/^9\d{8}$/.test(limpio)) numero = `51${limpio}`;
  else if (/^\+\d{8,15}$/.test(limpio)) numero = limpio.slice(1);
  else if (/^51 ?9\d{8}$/.test(limpio)) numero = limpio;
  if (!numero) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

/**
 * Lo que se le escribe a un cliente al abrir WhatsApp desde su ficha. Si debe, el recordatorio va con el monto, amable y sin apuro (es un
 * cliente que vuelve); si no debe, solo el saludo. Se le habla como en el puesto: por su apodo («don Lucho») si tiene, si no por su nombre.
 */
export function mensajeAlCliente({ nombre, apodo, saldo }: { nombre: string; apodo?: string | null; saldo: number }): string {
  const como = (apodo ?? "").trim() || nombre.trim();
  const saludo = como ? `Hola ${como}` : "Hola";
  const centimos = Math.round(saldo * 100);
  if (centimos <= 0) return `${saludo}, ¿cómo estás?`;
  return `${saludo}, ¿cómo estás? Te escribo por tu cuenta del puesto: van ${formatearSoles(centimos / 100)}. ¿Cuándo pasas a abonar?`;
}
