import { formatearSoles } from "@/lib/formato";

type Props = { nombre: string; saldo: number; total: number; alCredito: boolean };

// Cómo queda la deuda del cliente con esta venta, antes de confirmar (ley 3: un veredicto, no una cuenta).
// Con «Pagó», la venta no suma: basta una línea que recuerda lo que debe de antes, y nada si no debe (/formidable 2026-10-29).
export function MedidorDeuda({ nombre, saldo, total, alCredito }: Props) {
  if (!alCredito) {
    if (saldo <= 0) return null;
    return (
      <p className="mx-1 text-lg">
        De antes, {nombre} te debe <strong className="cifra text-deuda">{formatearSoles(saldo)}</strong>
      </p>
    );
  }
  const tope = Math.max(1, saldo + total);
  return (
    <div className="rounded-[20px] bg-superficie px-3.5 py-3">
      <p className="mb-2 text-lg">
        Con esta venta, {nombre} te debe <strong className="cifra text-deuda">{formatearSoles(saldo + total)}</strong>
      </p>
      <div aria-hidden className="flex h-3.5 overflow-hidden rounded-full bg-texto/8">
        <span className="h-full bg-deuda/55 transition-[width] duration-700 ease-salida" style={{ width: `${(100 * saldo) / tope}%` }} />
        <span className="h-full bg-deuda transition-[width] duration-700 ease-salida" style={{ width: `${(100 * total) / tope}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-base text-texto-suave">
        <span>{saldo > 0 ? `Ya debía ${formatearSoles(saldo)}` : "No debía nada"}</span>
        <span>+ {formatearSoles(total)} de hoy</span>
      </div>
    </div>
  );
}
