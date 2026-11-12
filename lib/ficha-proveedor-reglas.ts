// La ficha de un proveedor: lo que le compraste y le pagaste día por día, y cómo escribirle. Lógica pura: no importa React ni Supabase.
import { diaDeLima } from "./formato";
import { etiquetaDeDia, horaDeLima, type DiaOperaciones } from "./ficha-cliente-reglas";
import { deCompra, medios, type CompraLeida, type Medio, type Operacion } from "./operaciones-reglas";

export const HISTORIAL_TOPE = 30;

export type CompraDelProveedor = CompraLeida & { condicion: "contado" | "credito" };
export type PagoLeido = { id: number; fecha: string; monto: number; medio: Medio; nota: string | null };

function deCompraSuya(c: CompraDelProveedor): Operacion {
  const op = deCompra(c);
  // En su ficha, una compra fiada se ve como lo que es: plata que le debes.
  return c.condicion === "credito" ? { ...op, detalle: `${op.detalle}, al crédito`, estado: "credito" } : op;
}

function dePago(p: PagoLeido): Operacion {
  return {
    clave: `pago-${p.id}`,
    fecha: p.fecha,
    titulo: "Pago",
    detalle: `Le pagaste ${medios[p.medio]}${p.nota ? ` · ${p.nota}` : ""}`,
    monto: p.monto,
    estado: "pagaste",
    persona: null,
    fruta: null,
  };
}

/**
 * Las compras y los pagos de un proveedor, de lo más reciente a lo más viejo y agrupados por día de Lima. Quien lee pide
 * `tope + 1` de cada tabla: si llega más de `tope`, hay más y se avisa.
 */
export function historialDelProveedor(
  entrada: { compras: CompraDelProveedor[]; pagos: PagoLeido[] },
  ahora: Date,
  tope: number = HISTORIAL_TOPE,
): { dias: DiaOperaciones[]; hayMas: boolean } {
  const todas = [...entrada.compras.map(deCompraSuya), ...entrada.pagos.map(dePago)].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const dias = new Map<string, DiaOperaciones>();
  for (const op of todas.slice(0, tope)) {
    const fecha = new Date(op.fecha);
    const dia = diaDeLima(fecha);
    if (!dias.has(dia)) dias.set(dia, { dia, etiqueta: etiquetaDeDia(fecha, ahora), operaciones: [] });
    // Todas son del mismo proveedor: la fila dice qué pasó y a qué hora, sin repetir su nombre (ley 8).
    dias.get(dia)!.operaciones.push({ ...op, titulo: op.detalle, detalle: horaDeLima(fecha), persona: null });
  }
  return { dias: [...dias.values()], hayMas: todas.length > tope };
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
