import { Thermometer } from "lucide-react";
import { cn } from "cn";

import { TemperaturaAMano } from "@/components/frescura/TemperaturaAMano";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { diaCorto, ultimaAnotada } from "@/lib/frescura-reglas";
import { diaAnterior, formatearGrados, semanaDeTemperaturas, temperaturaDe, veredictoClima, type TemperaturaDia } from "@/lib/temperatura-reglas";

const COLOR = { fuerte: "bg-deuda/75", calor: "bg-sol/60", normal: "bg-exito/60", fresco: "bg-exito/60" } as const;
/** La altura de la barra de un día: sube con la temperatura, entre un mínimo que se ve y un tope que no rompe la tarjeta. */
const alto = (grados: number) => Math.min(72, Math.max(12, 14 + (grados - 20) * 4));

type Props = { hoy: string; lecturas: TemperaturaDia[]; puedeRegistrar: boolean };

// «El clima del puesto»: la temperatura de hoy, qué le hace a la fruta y la semana en barras. Va al final de «Qué hacer»: explica
// por qué los avisos de arriba dicen lo que dicen, y desde aquí se anota o se corrige la de hoy.
export function ClimaPuesto({ hoy, lecturas, puedeRegistrar }: Props) {
  const deHoy = temperaturaDe(lecturas, hoy);
  const ultima = ultimaAnotada(lecturas, hoy);
  const veredicto = deHoy === null ? null : veredictoClima(deHoy);
  const semana = semanaDeTemperaturas(lecturas, hoy);
  return (
    <section aria-labelledby="clima-puesto" className="mt-6">
      <h2 id="clima-puesto" className="mb-2.5 text-xl font-extrabold">
        El clima del puesto
      </h2>
      <Tarjeta className="grid gap-3">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <span className="grid size-12 place-items-center rounded-[16px] bg-sol/12 text-sol">
            <Thermometer aria-hidden />
          </span>
          <span className="grid">
            <span className="font-bold text-texto-suave">En el puesto hoy</span>
            <span className={cn("cifra", deHoy === null ? "text-2xl" : "text-cifra")}>{deHoy === null ? "Sin anotar" : formatearGrados(deHoy)}</span>
          </span>
        </div>
        <p className="leading-snug">
          {veredicto ? (
            <>
              <strong>{veredicto.titulo}:</strong> {veredicto.efecto}
            </>
          ) : ultima ? (
            <>
              Mientras tanto cuento con la última que anotaste (<strong>{formatearGrados(ultima.grados)}</strong>).
            </>
          ) : (
            "Anótala cada mañana. Sin ella, cada día cuenta como uno normal y el aviso puede llegar tarde."
          )}
        </p>
        <div
          role="img"
          aria-label={`Temperatura de la semana: ${semana.map((d) => `${d.dia === hoy ? "hoy" : diaCorto(d.dia)} ${d.grados === null ? "sin anotar" : `${d.grados} grados`}`).join(", ")}`}
          className="grid grid-flow-col auto-cols-fr items-end gap-1.5"
        >
          {semana.map((d) => (
            <span key={d.dia} className="grid justify-items-center gap-1">
              <span className="text-[15px] font-extrabold tabular-nums">{d.grados === null ? "—" : formatearGrados(d.grados)}</span>
              <span
                className={cn("w-full max-w-9 rounded-t-[9px] rounded-b-[4px]", d.grados === null ? "border-2 border-dashed border-borde" : COLOR[veredictoClima(d.grados).nivel])}
                style={{ height: d.grados === null ? 24 : alto(d.grados) }}
              />
              <span className={cn("text-sm font-bold", d.dia === hoy ? "text-texto" : "text-texto-suave")}>{d.dia === hoy ? "hoy" : diaCorto(d.dia)}</span>
            </span>
          ))}
        </div>
        {puedeRegistrar && <TemperaturaAMano hoy={deHoy} ayer={temperaturaDe(lecturas, diaAnterior(hoy))} etiqueta={deHoy === null ? "Anotar la temperatura" : "Corregir la de hoy"} />}
      </Tarjeta>
    </section>
  );
}
