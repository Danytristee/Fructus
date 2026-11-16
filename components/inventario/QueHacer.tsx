"use client";

import { useRef, useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Filtros } from "@/components/ui/Filtros";
import { Vacio } from "@/components/ui/Vacio";
import { juntarAlertas, type Alerta, type EstadoProducto, type TipoAlerta } from "@/lib/inventario-reglas";
import type { TemperaturaDia } from "@/lib/temperatura-reglas";
import { ClimaPuesto } from "./ClimaPuesto";
import { TarjetaAlerta, tipos } from "./TarjetaAlerta";

type Filtro = "todas" | TipoAlerta;

// Cuántas tarjetas se ven de entrada en «Todas»: lo demás, a un toque. Con 10, la lista de frutas quedaba a 3.6 pantallas (/formidable 2026-11-10).
const TARJETAS_A_LA_VISTA = 3;

type Props = {
  alertas: Alerta[];
  estados: EstadoProducto[];
  hoy: string;
  lecturas: TemperaturaDia[];
  puedeRegistrar: boolean;
  /** Abre el porqué de la llegada que se acaba antes de esa fruta. */
  alVerFruta: (productoId: number) => void;
};

// «Qué hacer»: los avisos con su recomendación; debajo, los filtros por tipo, y al final el clima del puesto, que explica los de
// frescura. Los filtros iban arriba: tres filas que empujaban el primer aviso al 38 % de la pantalla (47 % a 360 px), para una
// lista que ya abre con lo más urgente (/formidable 2026-11-14).
export function QueHacer({ alertas, estados, hoy, lecturas, puedeRegistrar, alVerFruta }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [todasALaVista, setTodasALaVista] = useState(false);
  const seccion = useRef<HTMLElement>(null);
  const hay = (t: TipoAlerta) => alertas.some((a) => a.tipo === t);
  function filtrar(f: Filtro) {
    setFiltro(f);
    setTodasALaVista(false);
    // Los filtros están debajo de la lista: al elegir uno, la lista nueva se muestra desde su primer aviso.
    requestAnimationFrame(() => {
      if ((seccion.current?.getBoundingClientRect().top ?? 0) < 0) seccion.current?.scrollIntoView({ block: "start" });
    });
  }
  // Las del mismo tipo y urgencia, en una tarjeta. Con un filtro se ven todas; en «Todas», las primeras y el resto a un toque.
  const tarjetas = juntarAlertas(filtro === "todas" ? alertas : alertas.filter((a) => a.tipo === filtro));
  const recortar = filtro === "todas" && !todasALaVista && tarjetas.length > TARJETAS_A_LA_VISTA;
  const visibles = recortar ? tarjetas.slice(0, TARJETAS_A_LA_VISTA) : tarjetas;
  const escondidas = tarjetas.slice(TARJETAS_A_LA_VISTA).reduce((s, g) => s + g.alertas.length, 0);
  const nombreDe = new Map(estados.map((e) => [e.id, e.nombre]));
  return (
    <div>
      <section ref={seccion} aria-labelledby="que-hacer" className="mt-4 scroll-mt-3 lg:mt-6">
        {/* En celular la pestaña ya dice el título: el h2 queda para el lector de pantalla y para el escritorio, que no tiene pestañas. */}
        <h2 id="que-hacer" className="sr-only text-xl font-extrabold lg:not-sr-only lg:mb-2.5">
          Qué hacer hoy
        </h2>
        {tarjetas.length === 0 ? (
          <Vacio icono={<Lightbulb />} titulo="Todo en orden">
            Ninguna fruta necesita que hagas algo hoy.
          </Vacio>
        ) : (
          <>
            <ul key={filtro} className="grid gap-2.5">
              {visibles.map((g, i) => (
                <TarjetaAlerta key={g.clave} g={g} nombreDe={nombreDe} i={i} alVerFruta={alVerFruta} />
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
        {alertas.length > 0 && (
          <Filtros
            className="mt-4"
            etiqueta="Filtrar alertas"
            valor={filtro}
            alCambiar={filtrar}
            opciones={[
              // Sin números: contaban avisos junto a cifras que cuentan frutas («Por malograrse 3» frente a «2 frutas tienen que salir
              // hoy»), y en la prueba a ciegas nadie supo a cuál creerle (/formidable 2026-11-10 y 2026-11-14).
              { valor: "todas" as Filtro, etiqueta: "Todas" },
              ...(Object.keys(tipos) as TipoAlerta[]).filter(hay).map((t) => ({ valor: t as Filtro, etiqueta: tipos[t].etiqueta })),
            ]}
          />
        )}
      </section>
      <ClimaPuesto hoy={hoy} lecturas={lecturas} puedeRegistrar={puedeRegistrar} />
    </div>
  );
}
