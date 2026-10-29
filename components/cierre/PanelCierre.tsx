import { Banknote, HandCoins, PackagePlus, ReceiptText, TrendingUp, Wallet } from "lucide-react";

import { Monto } from "@/components/ui/Monto";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import type { Cierre, Medio } from "@/lib/cierre-reglas";
import { formatearSoles } from "@/lib/formato";

const medios: Record<Medio, string> = { efectivo: "Efectivo", yape: "Yape", plin: "Plin", transferencia: "Transferencia", otro: "Otro" };

// El cierre del día: el efectivo que debería haber en la caja como protagonista, y de dónde sale ese número.
export function PanelCierre({ c }: { c: Cierre }) {
  const pctContado = c.vendido > 0 ? (100 * c.contado) / c.vendido : 0;
  const mayor = Math.max(1, ...c.porMedio.flatMap((m) => [m.entra, m.sale]));
  const tiles = [
    { etiqueta: "Vendiste", valor: c.vendido, Icono: TrendingUp, clase: "bg-acento/12 text-acento-texto" },
    { etiqueta: "Abonos", valor: c.abonos, Icono: HandCoins, clase: "bg-exito-fondo text-exito" },
    { etiqueta: "Gastos", valor: c.gastos, Icono: ReceiptText, clase: "bg-deuda-fondo text-deuda" },
    { etiqueta: "Compras", valor: c.compras, Icono: PackagePlus, clase: "bg-texto/8 text-texto" },
  ];

  return (
    <div className="grid gap-2.5">
      <Tarjeta protagonista className="grid animate-subir gap-1">
        <span className="flex items-center gap-2 font-bold text-texto-suave">
          <Banknote aria-hidden className="size-5" /> Debería haber en tu caja
        </span>
        <MontoVivo valor={c.efectivoEsperado} tamano="total" tono={c.efectivoEsperado < 0 ? "deuda" : "normal"} />
        <span className="text-texto-suave">en efectivo. Cuenta tu caja y compara: si no cuadra, revisa los gastos del día.</span>
        {c.digital > 0 && (
          <span className="mt-1 text-texto-suave">
            Además entraron <strong className="cifra font-extrabold text-texto">{formatearSoles(c.digital)}</strong> por Yape, Plin o transferencia.
          </span>
        )}
      </Tarjeta>

      <Tarjeta className="grid animate-subir grid-cols-[auto_1fr] items-center gap-4 [animation-delay:80ms]">
        <figure className="relative grid size-24 place-items-center" aria-label={`${Math.round(pctContado)} % de lo vendido fue al contado`}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="4" pathLength={100} className="stroke-deuda/80" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              strokeWidth="4"
              pathLength={100}
              strokeDasharray={`${pctContado} 100`}
              className="animate-dibujar-anillo stroke-exito"
            />
          </svg>
          <span className="cifra text-xl">{Math.round(pctContado)}%</span>
        </figure>
        <div className="grid gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-bold">
              <span aria-hidden className="size-3 rounded-full bg-exito" /> Al contado
            </span>
            <Monto valor={c.contado} />
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-bold">
              <span aria-hidden className="size-3 rounded-full bg-deuda/80" /> Al crédito
            </span>
            <Monto valor={c.credito} tono="deuda" />
          </span>
        </div>
      </Tarjeta>

      <Tarjeta className="animate-subir [animation-delay:140ms]">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
          <Wallet aria-hidden className="size-5 text-acento-texto" /> Cómo entró y salió la plata
        </h2>
        <ul className="grid gap-3">
          {c.porMedio.map((m, i) => (
            <li key={m.medio} className="grid gap-1">
              <span className="flex justify-between font-bold">
                {medios[m.medio]}
                <span className="cifra">{formatearSoles(m.entra - m.sale)}</span>
              </span>
              <span className="grid gap-1" aria-hidden>
                <span className="block h-2.5 overflow-hidden rounded-full bg-texto/8">
                  <span className="block h-full origin-left animate-llenar rounded-full bg-exito" style={{ width: `${(100 * m.entra) / mayor}%`, animationDelay: `${300 + i * 80}ms` }} />
                </span>
                {m.sale > 0 && (
                  <span className="block h-2.5 overflow-hidden rounded-full bg-texto/8">
                    <span className="block h-full origin-left animate-llenar rounded-full bg-deuda" style={{ width: `${(100 * m.sale) / mayor}%`, animationDelay: `${340 + i * 80}ms` }} />
                  </span>
                )}
              </span>
              <span className="text-[15px] text-texto-suave">
                entró {formatearSoles(m.entra)}
                {m.sale > 0 && `, salió ${formatearSoles(m.sale)}`}
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map(({ etiqueta, valor, Icono, clase }, i) => (
          <Tarjeta key={etiqueta} className="grid animate-subir gap-1.5" style={{ animationDelay: `${200 + i * 60}ms` }}>
            <span className={`grid size-10 place-items-center rounded-2xl ${clase}`}>
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="font-bold text-texto-suave">{etiqueta}</span>
            <Monto valor={valor} className="text-xl" />
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
