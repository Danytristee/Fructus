// Dinero y cantidades como se leen en el puesto. Una sola fuente para toda la app.

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

/** S/ 1,250.00 — siempre con dos decimales. El espacio es duro para que «S/» no quede solo al final de una línea. */
export function formatearSoles(monto: number): string {
  return soles.format(monto).replace(/\s/, " ");
}

/** 1 caja, 10 cajas, 2.5 cajas. */
export function formatearCajas(cantidad: number): string {
  const numero = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toLocaleString("es-PE", { maximumFractionDigits: 2 });
  return `${numero} ${cantidad === 1 ? "caja" : "cajas"}`;
}
