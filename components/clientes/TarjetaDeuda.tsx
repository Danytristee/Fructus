import { Avatar } from "@/components/ui/Avatar";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { estadoDeuda, parteDeLaDeuda } from "@/lib/ficha-cliente-reglas";
import { formatearHace } from "@/lib/formato";

type Props = {
  iniciales: string;
  tono: number;
  saldo: number;
  /** Lo que te deben todos juntos, para decir cuánto pesa este cliente. */
  deudaTotal: number;
  ultimaVentaCredito: string | null;
  ultimoAbono: string | null;
};

// El veredicto de la ficha (ley 3): cuánto te debe, está al día o tiene a favor, en una cifra. Debajo, lo último que pasó.
export function TarjetaDeuda({ iniciales, tono, saldo, deudaTotal, ultimaVentaCredito, ultimoAbono }: Props) {
  const estado = estadoDeuda(saldo);
  const ahora = new Date();
  const parte = parteDeLaDeuda(saldo, deudaTotal);

  return (
    <>
      <Tarjeta protagonista className="grid animate-subir gap-1" data-testid="deuda-cliente">
        <span className="flex items-center gap-3 font-bold text-texto-suave">
          <Avatar iniciales={iniciales} tono={tono} />
          {estado.tipo === "debe" ? "Te debe" : estado.tipo === "a_favor" ? "Tiene a favor" : "Su cuenta"}
        </span>
        {estado.tipo === "al_dia" ? (
          // La palabra es la señal; el verde solo la acompaña.
          <p className="text-cifra font-extrabold text-exito">Al día</p>
        ) : (
          <MontoVivo valor={estado.monto} tamano="total" tono={estado.tipo === "debe" ? "deuda" : "exito"} />
        )}
        <span className="text-texto-suave">
          {estado.tipo === "debe" && `Es el ${parte} % de todo lo que te deben`}
          {estado.tipo === "al_dia" && "No te debe nada"}
          {estado.tipo === "a_favor" && "Pagó más de lo que debía: le queda saldo a favor"}
        </span>
        {estado.tipo === "debe" && (
          <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-texto/10" aria-hidden>
            <span className="block h-full origin-left animate-llenar rounded-full bg-deuda" style={{ width: `${parte}%` }} />
          </span>
        )}
      </Tarjeta>
      <dl className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-control bg-texto/5 px-3 py-2">
          <dt className="text-texto-suave">Último fiado</dt>
          <dd className="font-extrabold">{ultimaVentaCredito ? formatearHace(new Date(ultimaVentaCredito), ahora) : "—"}</dd>
        </div>
        <div className="rounded-control bg-texto/5 px-3 py-2">
          <dt className="text-texto-suave">Último abono</dt>
          <dd className="font-extrabold">{ultimoAbono ? formatearHace(new Date(ultimoAbono), ahora) : "nunca"}</dd>
        </div>
      </dl>
    </>
  );
}
