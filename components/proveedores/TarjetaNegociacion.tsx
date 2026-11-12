import { BadgePercent, HandCoins, Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { formatearHace } from "@/lib/formato";
import { porcentaje, porQue, TITULOS, type Palanca } from "@/lib/negociacion-reglas";
import type { AnalisisProveedor } from "@/lib/proveedores-reglas";

const iconos: Record<Palanca["tipo"], typeof Lightbulb> = { ahorro: BadgePercent, subio: TrendingUp, unica: TriangleAlert, deuda: HandCoins };

type Props = { analisis: AnalisisProveedor; palancas: Palanca[]; iniciales: string; tono: number };

// El veredicto de la ficha (ley 3): qué te conviene hacer con este proveedor, por qué, y con qué negociar. Debajo, en tres cifras, lo que
// lo explica: cuánto pesa en tus compras, cada cuánto le compras y cuánto le debes.
export function TarjetaNegociacion({ analisis: a, palancas, iniciales, tono }: Props) {
  const ahora = new Date();
  return (
    <>
      <Tarjeta protagonista className="grid animate-subir gap-2" data-testid="negociacion">
        <span className="flex items-center gap-3 font-bold text-texto-suave">
          <Avatar iniciales={iniciales} tono={tono} />
          Para negociar con él
        </span>
        <span>
          <Insignia tipo={a.posicion} className="text-base">
            {TITULOS[a.posicion]}
          </Insignia>
        </span>
        <p className="text-lg leading-snug">{porQue(a)}</p>
        {palancas.length > 0 && (
          <ul className="mt-1 grid gap-2 border-t border-border pt-3" aria-label="Con qué negociar">
            {palancas.map((p) => {
              const Icono = iconos[p.tipo];
              return (
                <li key={p.texto} className="grid grid-cols-[auto_1fr] items-start gap-2.5">
                  <Icono aria-hidden className={`mt-0.5 size-5 ${p.tipo === "ahorro" ? "text-exito" : p.tipo === "deuda" ? "text-deuda" : "text-sol"}`} />
                  <span className="leading-snug">{p.texto}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
      <dl className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-control bg-texto/5 px-3 py-2">
          <dt className="text-[15px] text-texto-suave">De tus compras</dt>
          <dd className="cifra text-xl font-extrabold">{a.total > 0 ? porcentaje(a.participacion) : "—"}</dd>
        </div>
        <div className="rounded-control bg-texto/5 px-3 py-2">
          <dt className="text-[15px] text-texto-suave">Le compras</dt>
          <dd className="text-xl font-extrabold">
            {a.cadaDias === null ? (a.ultimaCompra ? formatearHace(new Date(a.ultimaCompra), ahora) : "nunca") : `cada ${Math.max(1, Math.round(a.cadaDias))} días`}
          </dd>
        </div>
        {/* La deuda a lo ancho: en tres columnas, «S/ 28,823.00» no entraba a 412 px. */}
        <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 rounded-control bg-texto/5 px-3 py-2">
          <dt className="text-[15px] text-texto-suave">{a.saldo < 0 ? "Tienes a tu favor" : "Le debes"}</dt>
          <dd>
            {a.saldo > 0 ? (
              <Monto valor={a.saldo} tono="deuda" />
            ) : a.saldo < 0 ? (
              <Monto valor={-a.saldo} tono="exito" />
            ) : (
              <span className="text-xl font-extrabold text-exito">Nada: estás al día</span>
            )}
          </dd>
        </div>
      </dl>
    </>
  );
}
