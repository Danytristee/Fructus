import { formatearHora } from "@/lib/formato";
import { acumulado, curvaDelDia, horaPico, type HoraVentas } from "@/lib/hoy-reglas";

// Bajo a propósito (/formidable 2026-10-28): acompaña al monto, no ocupa media pantalla.
const ALTO = 64;

// Cómo se fue llenando la caja a lo largo del día (lo acumulado hora por hora). Solo SVG y CSS: no suma JavaScript a «Hoy».
export function GraficoDia({ horas }: { horas: HoraVentas[] }) {
  // Arranca en 0: la caja empieza vacía y se va llenando.
  const curva = horas.length > 0 ? curvaDelDia([{ hora: horas[0]!.hora, total: 0 }, ...acumulado(horas)], 320, ALTO) : null;
  const pico = horaPico(horas);
  if (!curva || pico === null) return null;

  const primera = horas[0]!.hora;
  const ultima = horas[horas.length - 1]!.hora;
  const medio = Math.round((primera + ultima) / 2);

  return (
    <figure className="mt-2.5 text-acento-texto" aria-label={`Lo vendido a lo largo del día: la hora que más vendiste fue a las ${formatearHora(pico)}`}>
      <svg viewBox={`0 0 320 ${ALTO}`} className="block h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="area-del-dia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={curva.area} fill="url(#area-del-dia)" className="animate-aparecer" />
        <path
          d={curva.linea}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={1}
          className="animate-dibujar"
        />
        <circle cx={curva.fin.x} cy={curva.fin.y} r={6} fill="currentColor" className="origin-center animate-latir [transform-box:fill-box]" />
        <circle cx={curva.fin.x} cy={curva.fin.y} r={5} fill="currentColor" stroke="var(--superficie)" strokeWidth={3} className="animate-aparecer" />
      </svg>
      <figcaption aria-hidden className="mt-1 flex justify-between text-[15px] text-texto-suave">
        <span>{formatearHora(primera)}</span>
        {ultima - primera >= 2 && <span>{formatearHora(medio)}</span>}
        <span>{formatearHora(ultima)}</span>
      </figcaption>
    </figure>
  );
}
