// El cierre del día: cuánto entró y salió, separado por medio de pago, y cuánto efectivo debería haber en la caja.
// Lógica pura: no importa React ni Supabase.
import { formatearFecha, formatearSoles } from "./formato";

export type Medio = "efectivo" | "yape" | "plin" | "transferencia" | "otro";
type Movimiento = { monto: number; medio: Medio | null };

export type DatosCierre = {
  ventasContado: Movimiento[];
  ventasCredito: number[];
  abonos: Movimiento[];
  gastos: Movimiento[];
  /** Compras pagadas al contado (las que salen de la caja hoy). */
  compras: Movimiento[];
};

export type Cierre = {
  vendido: number;
  contado: number;
  credito: number;
  abonos: number;
  /** Lo que entró por Yape, Plin o transferencia: no está en la caja, está en el banco o el celular. */
  digital: number;
  gastos: number;
  compras: number;
  /** Ventas al contado en efectivo + abonos en efectivo − gastos y compras pagados en efectivo. */
  efectivoEsperado: number;
  porMedio: { medio: Medio; entra: number; sale: number }[];
};

const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
const medioDe = (m: Movimiento) => m.medio ?? "efectivo";

export function calcularCierre(d: DatosCierre): Cierre {
  const entradas = [...d.ventasContado, ...d.abonos];
  const salidas = [...d.gastos, ...d.compras];
  const medios: Medio[] = ["efectivo", "yape", "plin", "transferencia", "otro"];
  const porMedio = medios
    .map((medio) => ({
      medio,
      entra: suma(entradas.filter((m) => medioDe(m) === medio).map((m) => m.monto)),
      sale: suma(salidas.filter((m) => medioDe(m) === medio).map((m) => m.monto)),
    }))
    .filter((x) => x.entra > 0 || x.sale > 0);
  const efectivo = porMedio.find((x) => x.medio === "efectivo");
  const contado = suma(d.ventasContado.map((m) => m.monto));
  const credito = suma(d.ventasCredito);
  return {
    vendido: suma([contado, credito]),
    contado,
    credito,
    abonos: suma(d.abonos.map((m) => m.monto)),
    digital: suma(entradas.filter((m) => medioDe(m) !== "efectivo").map((m) => m.monto)),
    gastos: suma(d.gastos.map((m) => m.monto)),
    compras: suma(d.compras.map((m) => m.monto)),
    efectivoEsperado: suma([efectivo?.entra ?? 0, -(efectivo?.sale ?? 0)]),
    porMedio,
  };
}

/** ¿Hubo algo que cerrar? Un día en cero no se manda a nadie: sería un mensaje vacío. */
export function hayMovimientoEnElCierre(c: Cierre): boolean {
  return c.vendido > 0 || c.abonos > 0 || c.gastos > 0 || c.compras > 0;
}

const soles = (monto: number) => formatearSoles(monto).replace(/\u00a0/g, " ");

/**
 * El cierre del día como se lee en WhatsApp: un título en negrita y una línea por cifra, con la misma cuenta de la pantalla.
 * Son etiquetas («Vendido», «Abonos»), no verbos: lo manda el dueño, pero también un ayudante al dueño o al contador.
 */
export function mensajeDelCierre(c: Cierre, fecha: Date): string {
  const lineas = [
    `*Cierre del día · ${formatearFecha(fecha)}*`,
    `Vendido: ${soles(c.vendido)}`,
    `• Al contado: ${soles(c.contado)}`,
    `• Al crédito: ${soles(c.credito)}`,
    `Abonos cobrados: ${soles(c.abonos)}`,
    `Gastos: ${soles(c.gastos)}`,
    `Compras al contado: ${soles(c.compras)}`,
    `Efectivo que debe haber en la caja: ${soles(c.efectivoEsperado)}`,
  ];
  if (c.digital > 0) lineas.push(`Por Yape, Plin o transferencia: ${soles(c.digital)}`);
  return lineas.join("\n");
}

/**
 * El enlace que abre WhatsApp con el cierre ya escrito y deja elegir a quién mandarlo. La persona lo manda: no se envía nada solo
 * (la API de WhatsApp cobra y queda fuera de la demo, CLAUDE.md).
 */
export function enlaceWhatsAppDelCierre(c: Cierre, fecha: Date): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeDelCierre(c, fecha))}`;
}
