import { Scale } from "lucide-react";

import { Monto } from "@/components/ui/Monto";
import { formatearSoles } from "@/lib/formato";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { porcentaje as pct } from "@/lib/negociacion-reglas";
import type { AnalisisProveedor, ResumenProveedores } from "@/lib/proveedores-reglas";


// Los tonos de la barra, del que más pesa al que menos. Todos salen de los tokens; «otros» va en gris.
const TONOS = ["bg-acento", "bg-lima", "bg-sol", "bg-exito"] as const;

// La pregunta de la pantalla, contestada en grande: ¿de quién dependes? El que más pesa, cuánto se llevan los tres primeros, y una
// barra con el reparto. Debajo, lo que debes. Sin compras en 90 días, lo dice y no dibuja una barra vacía.
export function TarjetaDependencia({ resumen, analisis }: { resumen: ResumenProveedores; analisis: AnalisisProveedor[] }) {
  const conCompras = analisis.filter((a) => a.total > 0);
  const primeros = conCompras.slice(0, TONOS.length);
  const otros = Math.max(0, 1 - primeros.reduce((s, a) => s + a.participacion, 0));

  return (
    <Tarjeta protagonista className="grid animate-subir gap-3">
      <span className="flex items-center gap-2.5 font-bold text-texto-suave">
        <span className="grid size-10 place-items-center rounded-2xl bg-acento/12 text-acento-texto">
          <Scale aria-hidden className="size-5" />
        </span>
        Últimos 90 días
      </span>
      {resumen.principal ? (
        <>
          <p className="grid gap-0.5">
            <span className="cifra text-total leading-none font-extrabold">{pct(resumen.principal.participacion)}</span>
            {/* wrap-anywhere: un nombre largo sin espacios se parte en vez de ensanchar la pantalla (/chaos 2026-11-09). */}
            <span className="text-lg leading-snug wrap-anywhere">
              de tus compras va a <strong>{resumen.principal.nombre}</strong>
            </span>
          </p>
          <div>
            <div className="flex h-4 overflow-hidden rounded-full bg-texto/8" aria-hidden>
              {primeros.map((a, i) => (
                <span key={a.id} className={`${TONOS[i]} h-full border-r-2 border-superficie last:border-r-0`} style={{ width: `${a.participacion * 100}%` }} />
              ))}
              {otros > 0.005 && <span className="h-full bg-texto/20" style={{ width: `${otros * 100}%` }} />}
            </div>
            <ul className="mt-2 grid gap-1 text-[15px] text-texto-suave">
              {primeros.map((a, i) => (
                <li key={a.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2">
                  <span aria-hidden className={`${TONOS[i]} size-2.5 shrink-0 translate-y-[-1px] rounded-full`} />
                  {/* El nombre entero, en dos líneas si hace falta: cortado («Importadora Frutícola d…») no se reconocía (/formidable 2026-11-12). */}
                  <span className="min-w-0 wrap-anywhere">{a.nombre}</span>
                  <span className="cifra font-bold text-texto">{pct(a.participacion)}</span>
                </li>
              ))}
              {otros > 0.005 && (
                <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 translate-y-[-1px] rounded-full bg-texto/20" />
                  <span>Los demás</span>
                  <span className="cifra font-bold text-texto">{pct(otros)}</span>
                </li>
              )}
            </ul>
          </div>
          <p className="text-texto-suave">
            Tus 3 primeros se llevan el <strong className="text-texto">{pct(resumen.top3)}</strong> de lo que compras
            {resumen.top3 >= 0.75 ? ": si uno te falla, lo sientes." : "."}
          </p>
        </>
      ) : (
        <p className="text-lg">Todavía no hay compras en los últimos 90 días. Cuando registres una, aquí verás a quién le compras más.</p>
      )}
      <div className="grid gap-0.5 border-t border-border pt-3">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-bold text-texto-suave">Les debes</span>
          {resumen.deuda > 0 ? (
            <Monto valor={resumen.deuda} tamano="cifra" tono="deuda" />
          ) : (
            <span className="font-extrabold text-exito">Nada: estás al día</span>
          )}
        </span>
        {/* El veredicto, no solo la suma: a quién le debes más (ley 3, /formidable 2026-11-12). */}
        {resumen.mayorDeuda && (
          <span className="text-texto-suave wrap-anywhere">
            {resumen.conDeuda === 1 ? "Todo a " : "Más que a nadie, a "}
            <strong className="text-texto">{resumen.mayorDeuda.nombre}</strong>
            {resumen.conDeuda > 1 && <> ({formatearSoles(resumen.mayorDeuda.saldo)})</>}
          </span>
        )}
      </div>
    </Tarjeta>
  );
}
