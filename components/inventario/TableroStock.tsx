"use client";

import { useState } from "react";
import { ChevronDown, Clock, Lightbulb, PackageX, ShoppingCart, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { Boton } from "@/components/ui/Boton";
import { Desplegable } from "@/components/ui/Desplegable";
import { Filtros } from "@/components/ui/Filtros";
import { IconoFruta } from "@/components/ui/IconoFruta";
import { Vacio } from "@/components/ui/Vacio";
import { MermaAMano } from "./MermaAMano";
import { juntarAlertas, listaDeStock, type Alerta, type EstadoProducto, type GrupoAlertas, type TipoAlerta } from "@/lib/inventario-reglas";
import { tituloEnGrupo } from "@/lib/productos-reglas";

type Filtro = "todas" | TipoAlerta;

const tipos: Record<TipoAlerta, { etiqueta: string; Icono: typeof Clock; clase: string }> = {
  deterioro: { etiqueta: "Por malograrse", Icono: TriangleAlert, clase: "bg-deuda-fondo text-deuda" },
  reponer: { etiqueta: "Reponer", Icono: ShoppingCart, clase: "bg-acento/12 text-acento-texto" },
  sobrestock: { etiqueta: "Te sobra", Icono: PackageX, clase: "bg-exito-fondo text-exito" },
  sin_movimiento: { etiqueta: "Sin movimiento", Icono: Clock, clase: "bg-texto/8 text-texto-suave" },
};

const dias = (n: number) => `${Math.round(n * 10) / 10} ${Math.round(n * 10) / 10 === 1 ? "día" : "días"}`;

// Cuántas tarjetas se ven de entrada en «Todas»: lo demás, a un toque. Con 10, «Tu stock» quedaba a 3.6 pantallas (/formidable 2026-11-10).
const TARJETAS_A_LA_VISTA = 3;

function TarjetaAlerta({ g, nombreDe, i }: { g: GrupoAlertas; nombreDe: Map<number, string>; i: number }) {
  const { Icono, clase } = tipos[g.tipo];
  const sola = g.alertas.length === 1 ? g.alertas[0]! : null;
  return (
    <li
      data-productos={g.alertas.map((a) => a.productoId).join(" ")}
      className={cn("vidrio grid animate-subir gap-3 rounded-tarjeta p-4", g.gravedad === "alta" && "animate-pulso-alerta")}
      style={{ animationDelay: `${i * 50}ms` }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
        {sola ? (
          <span className="relative">
            <IconoFruta nombre={nombreDe.get(sola.productoId) ?? sola.producto} tamano={44} />
            <span className={cn("absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full ring-2 ring-superficie", clase)}>
              <Icono aria-hidden className="size-3.5" strokeWidth={2.6} />
            </span>
          </span>
        ) : (
          <span className={cn("grid size-11 place-items-center rounded-full", clase)}>
            <Icono aria-hidden className="size-5" strokeWidth={2.4} />
          </span>
        )}
        <span className="grid gap-0.5">
          <span className="leading-tight font-extrabold">{g.titulo}</span>
          {sola ? (
            <span className="text-base leading-snug text-texto-suave">{g.detalle}</span>
          ) : (
            <ul className="mt-1 grid gap-1 text-base leading-snug">
              {g.alertas.map((a) => (
                <li key={a.productoId}>
                  <span className="font-bold">{a.producto}</span>
                  <span className="text-texto-suave"> · {a.corto}</span>
                </li>
              ))}
            </ul>
          )}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap", g.gravedad === "alta" ? "bg-deuda text-superficie" : "bg-texto/8 text-texto")}>
          {g.gravedad === "alta" ? "Hoy" : "Pronto"}
        </span>
      </div>
      <p className="flex gap-2 rounded-control bg-acento/8 px-3 py-2.5 leading-snug">
        <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
        <span>{g.recomendacion}</span>
      </p>
    </li>
  );
}

function FilaProducto({ e, puedeRegistrar }: { e: EstadoProducto; puedeRegistrar: boolean }) {
  const frescura = Math.round((1 - e.desgaste) * 100);
  const color = e.desgaste >= 0.85 ? "bg-deuda" : e.desgaste >= 0.6 ? "bg-sol" : "bg-exito";
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
                <span className="h-2 overflow-hidden rounded-full bg-texto/10" aria-hidden>
                  <span className={cn("block h-full origin-left animate-llenar rounded-full", color)} style={{ width: `${Math.max(6, frescura)}%` }} />
                </span>
              )}
            </span>
            <span className={cn("text-right", negativo && "text-deuda")}>
              <span className="cifra block text-xl">{negativo ? `\u2212${-e.stock}` : e.stock}</span>
              <span className={cn("text-[15px]", negativo ? "font-bold" : "text-texto-suave")}>{Math.abs(e.stock) === 1 ? "caja" : "cajas"}</span>
            </span>
          </span>
        }
      >
        <dl className="grid grid-cols-2 gap-2 pb-2">
          {[
            ["Alcanza para", e.coberturaDias === null ? "sin ventas" : dias(e.coberturaDias)],
            ["Vendes al día", `${Math.round(e.demandaDiaria * 10) / 10} cajas`],
            ["Lote más viejo", e.edadDias === null ? "—" : dias(e.edadDias)],
            ["Dura unos", dias(e.vidaUtil)],
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

// El tablero de Stock: alertas con su recomendación, filtrables por tipo, y la lista de frutas con su frescura.
export function TableroStock({ alertas, estados, puedeRegistrar }: { alertas: Alerta[]; estados: EstadoProducto[]; puedeRegistrar: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [todasALaVista, setTodasALaVista] = useState(false);
  const cuenta = (t: TipoAlerta) => alertas.filter((a) => a.tipo === t).length;
  // Las del mismo tipo y urgencia, en una tarjeta. Con un filtro se ven todas; en «Todas», las primeras y el resto a un toque.
  const tarjetas = juntarAlertas(filtro === "todas" ? alertas : alertas.filter((a) => a.tipo === filtro));
  const recortar = filtro === "todas" && !todasALaVista && tarjetas.length > TARJETAS_A_LA_VISTA;
  const visibles = recortar ? tarjetas.slice(0, TARJETAS_A_LA_VISTA) : tarjetas;
  const escondidas = tarjetas.slice(TARJETAS_A_LA_VISTA).reduce((s, g) => s + g.alertas.length, 0);
  const nombreDe = new Map(estados.map((e) => [e.id, e.nombre]));
  // Como el catálogo: por fruta, y dentro de cada fruta de la mejor selección a la de menos. Lo urgente ya lo dice «Qué hacer hoy».
  const { grupos, frutasSinCajas } = listaDeStock(estados);

  // En escritorio (ADR-0015): qué hacer hoy y tu stock, lado a lado.
  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <section aria-labelledby="que-hacer" className="mt-6">
        <h2 id="que-hacer" className="mb-2.5 text-xl font-extrabold">
          Qué hacer hoy
        </h2>
        <Filtros
          etiqueta="Filtrar alertas"
          valor={filtro}
          alCambiar={(f) => {
            setFiltro(f);
            setTodasALaVista(false);
          }}
          opciones={[
            // «Todas» sin número: contaba avisos (10) junto a recuadros que cuentan frutas (2 + 1 + 6) y al anillo (6 de 17), y el ciego
            // no supo a cuál creerle (/formidable 2026-11-10).
            { valor: "todas" as Filtro, etiqueta: "Todas" },
            ...(Object.keys(tipos) as TipoAlerta[]).filter((t) => cuenta(t) > 0).map((t) => ({ valor: t as Filtro, etiqueta: tipos[t].etiqueta, cuenta: cuenta(t) })),
          ]}
        />
        {tarjetas.length === 0 ? (
          <Vacio className="mt-3" icono={<Lightbulb />} titulo="Todo en orden">
            Ninguna fruta necesita que hagas algo hoy.
          </Vacio>
        ) : (
          <>
            <ul key={filtro} className="mt-3 grid gap-2.5">
              {visibles.map((g, i) => (
                <TarjetaAlerta key={g.clave} g={g} nombreDe={nombreDe} i={i} />
              ))}
            </ul>
            {recortar && (
              <Boton variante="secundario" className="mt-2.5 w-full" onClick={() => setTodasALaVista(true)}>
                <span className="flex items-center gap-2">
                  Ver {escondidas === 1 ? "1 aviso más" : `${escondidas} avisos más`} <ChevronDown aria-hidden className="size-5" />
                </span>
              </Boton>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="tu-stock" className="mt-6">
        <h2 id="tu-stock" className="mb-1 text-xl font-extrabold">
          Tu stock
        </h2>
        <p className="mb-2.5 text-texto-suave">Por fruta, de la mejor selección a la de menos. Toca una para ver el detalle.</p>
        {grupos.length === 0 && frutasSinCajas.length === 0 ? (
          <Vacio icono={<PackageX />} titulo="No tienes cajas en stock">
            Registra una compra para empezar a contar.
          </Vacio>
        ) : (
          <div className="grid gap-4">
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
                    <FilaProducto key={e.id} e={e} puedeRegistrar={puedeRegistrar} />
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
    </div>
  );
}
