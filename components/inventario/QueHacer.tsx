"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Vacio } from "@/components/ui/Vacio";
import { porUrgencia, type Alerta, type EstadoProducto, type GrupoAlertas } from "@/lib/inventario-reglas";
import type { TemperaturaDia } from "@/lib/temperatura-reglas";
import { ClimaPuesto } from "./ClimaPuesto";
import { TarjetaAlerta } from "./TarjetaAlerta";

type Props = {
  alertas: Alerta[];
  estados: EstadoProducto[];
  hoy: string;
  lecturas: TemperaturaDia[];
  puedeRegistrar: boolean;
  /** Abre el porqué de la llegada que se acaba antes de esa fruta. */
  alVerFruta: (productoId: number) => void;
};

// «Qué hacer», en dos grupos (decisión del 16-11, sobre maquetas): «Para hoy», a la vista, y «Puede esperar», plegado detrás de
// un botón. El título del grupo dice la urgencia una sola vez: ya no hay etiqueta roja en cada tarjeta, número en la pestaña ni
// filtros. El número no cuadraba para quien lo veía por primera vez y los filtros, abajo, se encontraban tarde (2.ª prueba a
// ciegas, 2026-11-15). Al final va el clima del puesto, que explica los avisos de frescura.
export function QueHacer({ alertas, estados, hoy, lecturas, puedeRegistrar, alVerFruta }: Props) {
  const [abierto, setAbierto] = useState(false);
  const { paraHoy, puedeEsperar, avisosQueEsperan } = porUrgencia(alertas);
  const nombreDe = new Map(estados.map((e) => [e.id, e.nombre]));
  const tarjetas = (grupos: GrupoAlertas[]) => (
    <ul className="grid gap-2.5">
      {grupos.map((g, i) => (
        <TarjetaAlerta key={g.clave} g={g} nombreDe={nombreDe} i={i} alVerFruta={alVerFruta} />
      ))}
    </ul>
  );
  // Sin nada para hoy, lo que puede esperar es lo único que hay que ver: no se esconde detrás de un toque.
  const verLoQueEspera = abierto || paraHoy.length === 0;
  return (
    <div>
      <section aria-labelledby="que-hacer" className="mt-4 lg:mt-6">
        {/* En celular la pestaña ya dice el título: el h2 queda para el lector de pantalla y para el escritorio, que no tiene pestañas. */}
        <h2 id="que-hacer" className="sr-only text-xl font-extrabold lg:not-sr-only lg:mb-2.5">
          Qué hacer hoy
        </h2>
        {alertas.length === 0 ? (
          <Vacio icono={<Lightbulb />} titulo="Todo en orden">
            Ninguna fruta necesita que hagas algo hoy.
          </Vacio>
        ) : (
          <div className="grid gap-4">
            <section aria-labelledby="para-hoy">
              <h3 id="para-hoy" className="mb-2 px-1 text-lg font-extrabold">
                Para hoy
              </h3>
              {paraHoy.length > 0 ? tarjetas(paraHoy) : <p className="vidrio rounded-tarjeta px-4 py-3 text-texto-suave">Hoy no urge nada.</p>}
            </section>
            {puedeEsperar.length > 0 && (
              <section aria-labelledby="puede-esperar">
                <h3 id="puede-esperar" className="mb-2 px-1 text-lg font-extrabold">
                  Puede esperar
                </h3>
                {verLoQueEspera ? (
                  tarjetas(puedeEsperar)
                ) : (
                  <Boton variante="secundario" className="w-full" onClick={() => setAbierto(true)}>
                    <span className="flex items-center gap-2">
                      Ver {avisosQueEsperan === 1 ? "1 aviso" : `${avisosQueEsperan} avisos`} <ChevronDown aria-hidden className="size-5" />
                    </span>
                  </Boton>
                )}
              </section>
            )}
          </div>
        )}
      </section>
      <ClimaPuesto hoy={hoy} lecturas={lecturas} puedeRegistrar={puedeRegistrar} />
    </div>
  );
}
