import { formatearSoles } from "@/lib/formato";

type Props = { saldo: number; total: number; alCredito: boolean };

// Cómo queda la deuda del cliente con esta venta, antes de confirmar (ley 3: un veredicto, no una cuenta).
// Con «Pagó», la venta no suma: basta una línea que recuerda lo que debe de antes, y nada si no debe (/formidable 2026-10-29).
// En dos renglones y sin el nombre, que está en la fila del cliente: con cinco, a 360 px la deuda quedaba debajo del pie y había que
// deslizar para leerla (/formidable 2026-11-18).
export function MedidorDeuda({ saldo, total, alCredito }: Props) {
  if (!alCredito) {
    if (saldo <= 0) return null;
    return (
      <p className="mx-1 text-lg">
        De antes te debe <strong className="cifra text-deuda">{formatearSoles(saldo)}</strong>
      </p>
    );
  }
  const tope = Math.max(1, saldo + total);
  return (
    <div className="rounded-[20px] bg-superficie px-3.5 py-2.5">
      {/* A 360 px caben 300 px: medido con Manrope, cada renglón entra en uno hasta S/ 9,999.99 de deuda (y el de abajo, con cinco
          cifras). Con más, la cifra baja sola a la derecha. «Ya debía» partía el de abajo con ventas de cuatro cifras. */}
      <p className="flex flex-wrap items-baseline justify-between gap-x-2">
        Con esta venta te debe
        <strong className="cifra ml-auto text-lg text-deuda">{formatearSoles(saldo + total)}</strong>
      </p>
      <div aria-hidden className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-texto/8">
        <span className="h-full bg-deuda/55 transition-[width] duration-700 ease-salida" style={{ width: `${(100 * saldo) / tope}%` }} />
        <span className="h-full bg-deuda transition-[width] duration-700 ease-salida" style={{ width: `${(100 * total) / tope}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-texto-suave">
        <span>{saldo > 0 ? `Debía ${formatearSoles(saldo)}` : "No debía nada"}</span>
        <span className="ml-auto">+ {formatearSoles(total)} hoy</span>
      </div>
    </div>
  );
}
