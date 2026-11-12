import { Apple } from "lucide-react";

import { Monto } from "@/components/ui/Monto";
import { Vacio } from "@/components/ui/Vacio";
import { formatearCajas, formatearSoles } from "@/lib/formato";
import type { FrutaDelProveedor } from "@/lib/proveedores-reglas";

type Props = { frutas: FrutaDelProveedor[]; nombreDe: Record<number, string> };

// Lo que te trae, con su último precio por caja frente al mejor de otro proveedor: «Andina: S/ 168, S/ 14 menos». Es lo que se pone sobre la
// mesa al negociar. Sin otro que la traiga, lo dice: ahí no hay con qué comparar.
export function FrutasDelProveedor({ frutas, nombreDe }: Props) {
  return (
    <section aria-labelledby="frutas-proveedor" className="mt-6">
      <h2 id="frutas-proveedor" className="mb-2 text-xl font-extrabold">
        Lo que te trae · 90 días
      </h2>
      {frutas.length === 0 ? (
        <Vacio icono={<Apple />} titulo="No le compraste en 90 días">
          Cuando registres una compra suya, aquí verás sus precios frente a los de otros.
        </Vacio>
      ) : (
        <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
          {frutas.map((f) => (
            <li key={f.productoId} className="grid gap-1 px-4 py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 leading-tight font-extrabold wrap-anywhere">{f.fruta}</span>
                <Monto valor={f.ultimoCosto} />
              </span>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[15px] text-texto-suave">
                <span>{formatearCajas(f.cajas)} · último precio por caja</span>
                {f.mejorOtro === null ? (
                  <span className="font-bold">Nadie más te la trae</span>
                ) : f.diferencia > 0 ? (
                  <span className="font-extrabold text-deuda">
                    {nombreDe[f.mejorOtro.proveedorId] ?? "Otro"}: {formatearSoles(f.mejorOtro.costo)} ({formatearSoles(f.diferencia)} menos)
                  </span>
                ) : f.diferencia < 0 ? (
                  <span className="font-extrabold text-exito">Es el más barato</span>
                ) : (
                  <span className="font-bold">Igual que {nombreDe[f.mejorOtro.proveedorId] ?? "otro"}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
