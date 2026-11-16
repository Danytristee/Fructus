"use client";

import { Check, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

import { Hoja } from "@/components/ui/Hoja";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { comoYCuandoLlego, consejoDeLlegada, explicacionDelCalor, origenDeLaCuenta, tonoDeLlegada, veredictoDeLlegada } from "@/lib/frescura-frases-reglas";
import { DIAS_DE_ENTRADAS, diaCorto, sePasoDeSuDia } from "@/lib/frescura-reglas";
import { cajas, type EstadoProducto, type LoteEstimado } from "@/lib/inventario-reglas";
import { veredictoClima } from "@/lib/temperatura-reglas";
import { MermaAMano } from "./MermaAMano";
import { SigueBuena } from "./SigueBuena";

const TONO = { hoy: "bg-deuda-fondo text-deuda", manana: "bg-sol/12 text-sol", bien: "bg-exito-fondo text-exito" } as const;
const CALOR = { fuerte: "bg-deuda/75", calor: "bg-sol/60", normal: "bg-exito/60", fresco: "bg-exito/60" } as const;
/**
 * Hasta cuántos días se rotulan uno por uno debajo de la barra: con más, las etiquetas no entran a 360 px y se dice en una frase.
 * Eran 7 con los grados a 14 px; a 17 px, que es lo que se lee al sol, el séptimo ya se pisa con el de al lado.
 */
const DIAS_CON_ROTULO = 6;
/** Desde qué parte de la barra el tramo vacío lleva su rótulo «le queda»: en uno más angosto se monta sobre «hoy». */
const QUEDA_CON_ROTULO = 0.25;

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
// Se titula «El calor de cada día»: «Lo que gastó cada día» se leyó como plata (/formidable 2026-11-14).
export function HojaPorQue({ abierta, alCambiar, fruta, lote, hoy, puedeRegistrar }: Props) {
  const veredicto = veredictoDeLlegada(lote, hoy);
  const consejo = consejoDeLlegada(lote);
  const tono = tonoDeLlegada(lote.restan);
  const origen = origenDeLaCuenta(lote, fruta.origenVida, hoy);
  // «Sigue buena» solo se le pregunta a la llegada que ya pasó su último día bueno (y que nadie revisó hoy).
  const preguntar = puedeRegistrar && sePasoDeSuDia(lote);
  const [errorRevision, setErrorRevision] = useState<string | null>(null);
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
          {tono === "bien" || lote.revisada ? <Check aria-hidden className="size-7 shrink-0" /> : <TriangleAlert aria-hidden className="size-7 shrink-0" />}
          <span className="grid">
            <strong className="text-2xl leading-tight font-extrabold">{veredicto.titulo}</strong>
            <span>{veredicto.detalle}</span>
          </span>
        </p>

        {lote.antes ? (
          // De estas cajas no se sabe el día: no hay calor que mostrar día por día, y se dice por qué.
          <p className="vidrio rounded-tarjeta p-4 leading-snug">
            No sé qué día llegaron: su compra tiene más de {DIAS_DE_ENTRADAS} días. Mira si siguen en el puesto y cómo están.
          </p>
        ) : (
          <section aria-labelledby="lo-gastado" className="vidrio grid gap-2 rounded-tarjeta p-4">
            <h3 id="lo-gastado" className="font-extrabold">
              El calor de cada día
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
                    <span className="text-base leading-tight font-extrabold tabular-nums">
                      {d.grados}°{algunaSinAnotar && !d.anotada ? "*" : ""}
                    </span>
                    <span className="text-[15px] font-bold whitespace-nowrap text-texto-suave">{d.dia === hoy ? "hoy" : diaCorto(d.dia)}</span>
                  </span>
                ))}
                {queda > 0.02 && (
                  <span className="grid min-w-0 basis-0 justify-items-center" style={{ flexGrow: queda }}>
                    <span className="text-base leading-tight">&nbsp;</span>
                    {queda >= QUEDA_CON_ROTULO && <span className="text-[15px] font-bold whitespace-nowrap text-texto-suave">le queda</span>}
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
        )}

        {consejo && (
          <p className="flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
            <span>{consejo}</span>
          </p>
        )}

        {/* Lo que la persona vio al mirar la fruta, a un toque: si sigue buena, queda anotado y sale de «para hoy» (ADR-0021); si
            ya se malogró, se registra desde aquí: ya trae la fruta, solo falta decir cuántas cajas. Al guardar la merma, esta hoja
            baja con la suya y se ve Stock con lo que quedó: si seguía abierta con las cajas de antes, parecía que la merma no había
            entrado y se registraba otra vez (/chaos 2026-11-14). */}
        {puedeRegistrar && (
          <div className="grid gap-2">
            {preguntar && errorRevision && (
              <p role="alert" className="rounded-control bg-superficie px-3.5 py-2.5 font-bold text-deuda ring-2 ring-deuda">
                {errorRevision}
              </p>
            )}
            {/* Lado a lado, como «Pagó / Lo debe». A menos de 400 px van sin dibujo: con él, «Sigue buena» se partía en dos líneas. */}
            <div className={cn("grid gap-2", preguntar && "grid-cols-2 max-[399px]:[&_button_svg]:hidden")}>
              {preguntar && <SigueBuena productoId={fruta.id} lote={lote} alError={setErrorRevision} />}
              <MermaAMano producto={{ id: fruta.id, nombre: fruta.nombre }} variante="fila" alGuardar={() => alCambiar(false)} />
            </div>
          </div>
        )}

        <p className="flex gap-2 text-[15px] leading-snug text-texto-suave">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-sol" />
          {/* De dónde sale la cuenta (ADR-0021): con cuántos días se contó y si lo dijo la tabla o la IA, con su motivo. */}
          <span>{origen ? `${origen} ` : ""}Es un cálculo aproximado. Mira la fruta antes de decidir.</span>
        </p>
      </div>
    </Hoja>
  );
}
