"use client";

import { Check, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { Hoja } from "@/components/ui/Hoja";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { comoYCuandoLlego, explicacionDelCalor, tonoDeLlegada, veredictoDeLlegada } from "@/lib/frescura-frases-reglas";
import { diaCorto } from "@/lib/frescura-reglas";
import { cajas, type EstadoProducto, type LoteEstimado } from "@/lib/inventario-reglas";
import { veredictoClima } from "@/lib/temperatura-reglas";
import { MermaAMano } from "./MermaAMano";

const TONO = { hoy: "bg-deuda-fondo text-deuda", manana: "bg-sol/12 text-sol", bien: "bg-exito-fondo text-exito" } as const;
const CALOR = { fuerte: "bg-deuda/75", calor: "bg-sol/60", normal: "bg-exito/60", fresco: "bg-exito/60" } as const;
/** Hasta cuántos días se rotulan uno por uno debajo de la barra: con más, las etiquetas no entran a 360 px y se dice en una frase. */
const DIAS_CON_ROTULO = 7;

type Props = {
  abierta: boolean;
  alCambiar: (abierta: boolean) => void;
  fruta: EstadoProducto;
  lote: LoteEstimado;
  /** El día de Lima de hoy (AAAA-MM-DD), el mismo con el que se hizo la cuenta. */
  hoy: string;
  puedeRegistrar: boolean;
};

// «¿Por qué sale hoy?» (ley 6: lo difícil, a un toque): qué parte de su vida gastó la llegada cada día, con qué temperatura,
// y cuánto le quitó el calor. La barra se llena de izquierda a derecha; cada tramo es un día y los de más calor ocupan más.
export function HojaPorQue({ abierta, alCambiar, fruta, lote, hoy, puedeRegistrar }: Props) {
  const veredicto = veredictoDeLlegada(lote, hoy);
  const tono = tonoDeLlegada(lote.restan);
  const queda = Math.max(0, 1 - lote.dias.reduce((s, d) => s + d.gasto, 0));
  const conRotulos = lote.dias.length <= DIAS_CON_ROTULO;
  const algunaAnotada = lote.dias.some((d) => d.anotada);
  const algunaSinAnotar = algunaAnotada && lote.dias.some((d) => !d.anotada);
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo={fruta.nombre} icono={<IconoFruta nombre={fruta.nombre} tamano={36} />}>
      <div className="grid gap-3">
        <p className="-mt-1 text-texto-suave first-letter:uppercase">
          {cajas(lote.cajas)} · {comoYCuandoLlego(lote, hoy)}
        </p>

        <p className={cn("flex items-center gap-3 rounded-control px-3.5 py-3 leading-snug", TONO[tono])}>
          {tono === "bien" ? <Check aria-hidden className="size-7 shrink-0" /> : <TriangleAlert aria-hidden className="size-7 shrink-0" />}
          <span className="grid">
            <strong className="text-2xl leading-tight font-extrabold">{veredicto.titulo}</strong>
            <span>{veredicto.detalle}</span>
          </span>
        </p>

        <section aria-labelledby="lo-gastado" className="vidrio grid gap-2 rounded-tarjeta p-4">
          <h3 id="lo-gastado" className="font-extrabold">
            Lo que gastó cada día
          </h3>
          <div aria-hidden className="flex h-5 gap-0.5 overflow-hidden rounded-full bg-texto/8">
            {lote.dias.map((d) => (
              <span key={d.dia} className={cn("min-w-0 basis-0", CALOR[veredictoClima(d.grados).nivel])} style={{ flexGrow: d.gasto }} />
            ))}
            {queda > 0.02 && <span className="basis-0" style={{ flexGrow: queda }} />}
          </div>
          {conRotulos ? (
            <div className="flex gap-0.5 text-center">
              {lote.dias.map((d) => (
                <span key={d.dia} className="grid min-w-0 basis-0 justify-items-center" style={{ flexGrow: d.gasto }}>
                  <span className="text-sm font-extrabold tabular-nums">
                    {d.grados}°{algunaSinAnotar && !d.anotada ? "*" : ""}
                  </span>
                  <span className="text-[13px] font-bold whitespace-nowrap text-texto-suave">{d.dia === hoy ? "hoy" : diaCorto(d.dia)}</span>
                </span>
              ))}
              {queda > 0.02 && (
                <span className="grid min-w-0 basis-0 justify-items-center" style={{ flexGrow: queda }}>
                  <span className="text-sm">&nbsp;</span>
                  <span className="text-[13px] font-bold whitespace-nowrap text-texto-suave">le queda</span>
                </span>
              )}
            </div>
          ) : (
            <p className="text-texto-suave">
              Lleva {lote.dias.length} días en el puesto{algunaAnotada ? `. El de más calor fue de ${Math.max(...lote.dias.map((d) => d.grados))}°` : ""}.
            </p>
          )}
          <p className="leading-snug">{explicacionDelCalor(lote, hoy)}</p>
          {algunaSinAnotar && conRotulos && <p className="text-[15px] leading-snug text-texto-suave">* Ese día no se anotó la temperatura: se contó con la última.</p>}
        </section>

        {lote.restan <= 1 && (
          <p className="flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
            <span>{lote.restan === 0 ? "Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja." : "Ponlo adelante y véndelo primero."}</span>
          </p>
        )}

        {/* Si ya se malogró, se registra desde aquí: ya trae la fruta, solo falta decir cuántas cajas. */}
        {puedeRegistrar && <MermaAMano producto={{ id: fruta.id, nombre: fruta.nombre }} variante="fila" />}

        <p className="flex gap-2 text-[15px] leading-snug text-texto-suave">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-sol" />
          <span>Es un cálculo aproximado. Mira la fruta antes de decidir.</span>
        </p>
      </div>
    </Hoja>
  );
}
