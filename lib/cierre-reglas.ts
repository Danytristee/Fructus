// El cierre del día: cuánto entró y salió, separado por medio de pago, y cuánto efectivo debería haber en la caja.
// Lógica pura: no importa React ni Supabase.

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
