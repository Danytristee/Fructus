"use client";

import { ChevronRight, PackageX, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { Desplegable } from "@/components/ui/Desplegable";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { Vacio } from "@/components/ui/Vacio";
import { comoYCuandoLlego, fraseDeLlegadas, nombreDeLlegada, tonoDeLlegada } from "@/lib/frescura-frases-reglas";
import { listaDeStock, type EstadoProducto, type LoteEstimado } from "@/lib/inventario-reglas";
import { tituloEnGrupo } from "@/lib/productos-reglas";
import { EtiquetaLlegada } from "./EtiquetaLlegada";
import { MermaAMano } from "./MermaAMano";

const dias = (n: number) => `${Math.round(n * 10) / 10} ${Math.round(n * 10) / 10 === 1 ? "día" : "días"}`;
const BARRA = { hoy: "bg-deuda", manana: "bg-sol", bien: "bg-exito" } as const;
const FRASE = { hoy: "font-bold text-deuda", manana: "font-bold text-sol", bien: "text-texto-suave" } as const;

type AlVer = (fruta: EstadoProducto, lote: LoteEstimado) => void;

function FilaProducto({ e, hoy, puedeRegistrar, alVer }: { e: EstadoProducto; hoy: string; puedeRegistrar: boolean; alVer: AlVer }) {
  const frescura = Math.round((1 - e.desgaste) * 100);
  // El color sigue a la llegada que se acaba antes; la frase de al lado dice lo mismo con palabras (el color nunca va solo).
  const tono = tonoDeLlegada(e.lotes[0]?.restan ?? 99);
  const frase = fraseDeLlegadas(e.lotes);
  // Menos de cero: se registró más salida que entrada (una merma de 8 con 5 en la app). No es «sin cajas», es un aviso (/chaos 2026-11-10).
  const negativo = e.stock < 0;
  return (
    <li className="px-4 py-1">
      <Desplegable
        resumen={
          <span className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <IconoFruta nombre={e.nombre} tamano={40} />
            <span className="grid min-w-0 gap-0.5">
              <span className="leading-tight font-extrabold wrap-anywhere">{tituloEnGrupo(e.partes)}</span>
              {e.detalle && <span className="text-[15px] leading-snug text-texto-suave">{e.detalle}</span>}
              {negativo ? (
                <span className="flex gap-1.5 text-[15px] leading-snug font-bold text-deuda">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  La app cuenta menos de cero: falta registrar una compra
                </span>
              ) : (
                <>
                  <span className="h-2 overflow-hidden rounded-full bg-texto/10" aria-hidden>
                    <span className={cn("block h-full origin-left animate-llenar rounded-full", BARRA[tono])} style={{ width: `${Math.max(6, frescura)}%` }} />
                  </span>
                  {frase && <span className={cn("text-[15px] leading-snug", FRASE[tono])}>{frase}</span>}
                </>
              )}
            </span>
            <span className={cn("text-right", negativo && "text-deuda")}>
              <span className="cifra block text-xl">{negativo ? `−${-e.stock}` : e.stock}</span>
              <span className={cn("text-[15px]", negativo ? "font-bold" : "text-texto-suave")}>{Math.abs(e.stock) === 1 ? "caja" : "cajas"}</span>
            </span>
          </span>
        }
      >
        {/* Cada llegada con lo que le queda; al tocarla, el porqué (ley 6: lo difícil, a un toque). */}
        {e.lotes.length > 0 && (
          <ul aria-label={`Llegadas de ${e.nombre}`} className="mb-2 divide-y divide-border overflow-hidden rounded-control bg-texto/5">
            {e.lotes.map((l) => (
              <li key={`${l.dia}-${l.estado ?? ""}`}>
                <button type="button" onClick={() => alVer(e, l)} className="flex min-h-14 w-full items-center gap-2 px-3 py-1.5 text-left active:bg-texto/5">
                  <span className="grid min-w-0 flex-1">
                    <span className="leading-tight font-extrabold">{nombreDeLlegada(l, hoy)}</span>
                    <span className="text-[15px] leading-snug text-texto-suave first-letter:uppercase">{comoYCuandoLlego(l, hoy)}</span>
                  </span>
                  <EtiquetaLlegada restan={l.restan} />
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-suave" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-2 gap-2 pb-2">
          {[
            ["Alcanza para", e.coberturaDias === null ? "sin ventas" : dias(e.coberturaDias)],
            ["Vendes al día", `${Math.round(e.demandaDiaria * 10) / 10} cajas`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-control bg-texto/5 px-3 py-2">
              <dt className="text-[15px] text-texto-suave">{k}</dt>
              <dd className="cifra text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        {e.alertas[0] && <p className="pb-2 text-texto-suave">{e.alertas[0].recomendacion}</p>}
        {/* Registrar lo que se malogró de esta fruta: ya trae la fruta, solo falta decir cuántas cajas. */}
        {puedeRegistrar && (
          <div className="pb-2">
            <MermaAMano producto={{ id: e.id, nombre: e.nombre }} variante="fila" />
          </div>
        )}
      </Desplegable>
    </li>
  );
}

type Props = { estados: EstadoProducto[]; resumen: { cajas: number; valor: number }; hoy: string; puedeRegistrar: boolean; alVer: AlVer };

// «Tu stock»: cuántas cajas hay y cuánto valen, y la lista por fruta con lo que le queda a cada llegada.
export function ListaStock({ estados, resumen, hoy, puedeRegistrar, alVer }: Props) {
  // Como el catálogo: por fruta, y dentro de cada fruta de la mejor selección a la de menos. Lo urgente ya lo dice «Qué hacer».
  const { grupos, frutasSinCajas } = listaDeStock(estados);
  return (
    <section aria-labelledby="tu-stock" className="mt-4 lg:mt-6">
      <h2 id="tu-stock" className="sr-only text-xl font-extrabold lg:not-sr-only lg:mb-2.5">
        Tu stock
      </h2>
      <Tarjeta className="mb-4 grid">
        <span className="font-bold text-texto-suave">Tienes en el puesto</span>
        <span className="cifra text-cifra">
          {resumen.cajas.toLocaleString("es-PE")} {resumen.cajas === 1 ? "caja" : "cajas"}
        </span>
        <span className="text-texto-suave">
          valen unos <MontoVivo valor={resumen.valor} className="font-extrabold text-texto" />
        </span>
      </Tarjeta>
      {grupos.length === 0 && frutasSinCajas.length === 0 ? (
        <Vacio icono={<PackageX />} titulo="No tienes cajas en stock">
          Registra una compra para empezar a contar.
        </Vacio>
      ) : (
        <div className="grid gap-4">
          <p className="-mb-1.5 text-texto-suave">Toca una fruta para ver cada llegada y cuánto le queda.</p>
          {grupos.map((g) => (
            <section key={g.fruta} aria-labelledby={`fruta-${g.fruta}`}>
              <h3 id={`fruta-${g.fruta}`} className="mb-1.5 flex items-baseline justify-between px-1 font-extrabold">
                <span>{g.fruta}</span>
                <span className="cifra text-[15px] font-bold text-texto-suave">
                  {g.cajas} {g.cajas === 1 ? "caja" : "cajas"}
                </span>
              </h3>
              <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
                {g.conCajas.map((e) => (
                  <FilaProducto key={e.id} e={e} hoy={hoy} puedeRegistrar={puedeRegistrar} alVer={alVer} />
                ))}
              </ul>
              {/* Lo que de esta fruta no tiene cajas: «¿te queda verde premium?» tiene respuesta sin buscar. */}
              {g.sinCajas.length > 0 && (
                <p className="mt-1.5 px-1 text-base leading-snug text-texto-suave">
                  <span className="font-bold text-texto">Sin cajas:</span> {g.sinCajas.join(", ")}
                </p>
              )}
            </section>
          ))}
          {frutasSinCajas.length > 0 && (
            <section aria-labelledby="sin-cajas" className="vidrio rounded-tarjeta px-4 py-3">
              <h3 id="sin-cajas" className="font-extrabold">
                Sin ninguna caja
              </h3>
              <p className="text-base leading-snug text-texto-suave">{frutasSinCajas.join(", ")}</p>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
