import { formatearSoles } from "@/lib/formato";

type Props = { nombre: string; saldo: number; total: number; alCredito: boolean };

// Cómo queda la deuda del cliente con esta venta, antes de confirmar (ley 3: un veredicto, no una cuenta).
export function MedidorDeuda({ nombre, saldo, total, alCredito }: Props) {
  const queda = alCredito ? saldo + total : saldo;
  const tope = Math.max(1, saldo + total);
  return (
    <div className="rounded-[20px] bg-superficie px-3.5 py-3">
      <p className="mb-2 text-lg">
        {alCredito ? `Con esta venta, ${nombre} te debe ` : saldo > 0 ? `${nombre} sigue debiendo ` : `${nombre} no te debe nada`}
        {(alCredito || saldo > 0) && <strong className="cifra text-deuda">{formatearSoles(queda)}</strong>}
      </p>
      <div aria-hidden className="flex h-3.5 overflow-hidden rounded-full bg-texto/8">
        <span className="h-full bg-deuda/55 transition-[width] duration-700 ease-salida" style={{ width: `${(100 * saldo) / tope}%` }} />
        <span className="h-full bg-deuda transition-[width] duration-700 ease-salida" style={{ width: alCredito ? `${(100 * total) / tope}%` : "0%" }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[15px] text-texto-suave">
        <span>{saldo > 0 ? `Ya debía ${formatearSoles(saldo)}` : "No debía nada"}</span>
        <span>{alCredito ? `+ ${formatearSoles(total)} de hoy` : "Hoy no suma"}</span>
      </div>
    </div>
  );
}
