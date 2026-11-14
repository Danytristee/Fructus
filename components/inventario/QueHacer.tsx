"use client";

import { useState } from "react";
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

// «Qué hacer»: los avisos con su recomendación, filtrables por tipo, y al final el clima del puesto, que explica los de frescura.
export function QueHacer({ alertas, estados, hoy, lecturas, puedeRegistrar, alVerFruta }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [todasALaVista, setTodasALaVista] = useState(false);
  const cuenta = (t: TipoAlerta) => alertas.filter((a) => a.tipo === t).length;
  // Las del mismo tipo y urgencia, en una tarjeta. Con un filtro se ven todas; en «Todas», las primeras y el resto a un toque.
  const tarjetas = juntarAlertas(filtro === "todas" ? alertas : alertas.filter((a) => a.tipo === filtro));
  const recortar = filtro === "todas" && !todasALaVista && tarjetas.length > TARJETAS_A_LA_VISTA;
  const visibles = recortar ? tarjetas.slice(0, TARJETAS_A_LA_VISTA) : tarjetas;
  const escondidas = tarjetas.slice(TARJETAS_A_LA_VISTA).reduce((s, g) => s + g.alertas.length, 0);
  const nombreDe = new Map(estados.map((e) => [e.id, e.nombre]));
  return (
    <div>
      <section aria-labelledby="que-hacer" className="mt-4 lg:mt-6">
        {/* En celular la pestaña ya dice el título: el h2 queda para el lector de pantalla y para el escritorio, que no tiene pestañas. */}
        <h2 id="que-hacer" className="sr-only text-xl font-extrabold lg:not-sr-only lg:mb-2.5">
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
            // «Todas» sin número: contaba avisos junto a cifras que cuentan frutas, y el ciego no supo a cuál creerle (/formidable 2026-11-10).
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
      </section>
      <ClimaPuesto hoy={hoy} lecturas={lecturas} puedeRegistrar={puedeRegistrar} />
    </div>
  );
}
