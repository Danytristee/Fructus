import { BadgePercent, HandCoins, Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Desplegable } from "@/components/ui/Desplegable";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { formatearHace } from "@/lib/formato";
import { porcentaje, porQue, TITULOS, type Palanca } from "@/lib/negociacion-reglas";
import type { AnalisisProveedor } from "@/lib/proveedores-reglas";

const iconos: Record<Palanca["tipo"], typeof Lightbulb> = { ahorro: BadgePercent, subio: TrendingUp, unica: TriangleAlert, deuda: HandCoins };
/** Las razones que se ven sin tocar; el resto, detrás de un toque (ley 6). */
const A_LA_VISTA = 3;

function Razones({ palancas }: { palancas: Palanca[] }) {
  return (
    <ul className="grid gap-2" aria-label="Con qué negociar">
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
  );
}

type Props = { analisis: AnalisisProveedor; palancas: Palanca[]; iniciales: string; tono: number };

// El veredicto de la ficha (ley 3): qué te conviene hacer con este proveedor y por qué; debajo, en grande, cuánto le debes, y en una
// línea cuánto pesa y cada cuánto le compras. Luego las 3 razones más fuertes para negociar, y el resto a un toque. Antes las cifras iban
// en una fila aparte que quedaba debajo de «Registrar pago», y en la prueba a ciegas no se encontraba la deuda (/formidable 2026-11-12).
export function TarjetaNegociacion({ analisis: a, palancas, iniciales, tono }: Props) {
  const ahora = new Date();
  // La deuda ya está en grande: repetirla como razón es ruido (ley 8).
  const razones = palancas.filter((p) => p.tipo !== "deuda");
  const frecuencia =
    a.cadaDias === null
      ? a.ultimaCompra
        ? `le compraste ${formatearHace(new Date(a.ultimaCompra), ahora)}`
        : "nunca le compraste"
      : `le compras cada ${Math.max(1, Math.round(a.cadaDias))} días`;

  return (
    <Tarjeta protagonista className="grid animate-subir gap-3" data-testid="negociacion">
      <div className="grid gap-2">
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
      </div>

      <div className="grid gap-1 rounded-control bg-texto/5 px-3.5 py-3">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-bold text-texto-suave">{a.saldo < 0 ? "Tienes a tu favor" : "Le debes"}</span>
          {a.saldo > 0 ? (
            <Monto valor={a.saldo} tamano="cifra" tono="deuda" />
          ) : a.saldo < 0 ? (
            <Monto valor={-a.saldo} tamano="cifra" tono="exito" />
          ) : (
            <span className="text-xl font-extrabold text-exito">Nada: estás al día</span>
          )}
        </span>
        <span className="text-texto-suave first-letter:uppercase">
          {a.total > 0 ? (
            <>
              <strong className="cifra text-texto">{porcentaje(a.participacion)}</strong> de tus compras · {frecuencia}
            </>
          ) : (
            frecuencia
          )}
        </span>
      </div>

      {razones.length > 0 && (
        <div className="grid gap-1 border-t border-border pt-3">
          <Razones palancas={razones.slice(0, A_LA_VISTA)} />
          {razones.length > A_LA_VISTA && (
            <Desplegable
              resumen={
                <span className="font-extrabold text-acento-texto">
                  Ver {razones.length - A_LA_VISTA} {razones.length - A_LA_VISTA === 1 ? "razón más" : "razones más"}
                </span>
              }
            >
              <Razones palancas={razones.slice(A_LA_VISTA)} />
            </Desplegable>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
