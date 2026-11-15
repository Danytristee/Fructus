"use client";

import { useState } from "react";
import { cn } from "cn";

import { Segmento } from "@/components/ui/Segmento";
import { veredictoDelStock, type Alerta, type EstadoProducto, type LoteEstimado } from "@/lib/inventario-reglas";
import type { TemperaturaDia } from "@/lib/temperatura-reglas";
import { HojaPorQue } from "./HojaPorQue";
import { ListaStock } from "./ListaStock";
import { QueHacer } from "./QueHacer";

type Pestana = "hacer" | "stock";

type Props = {
  alertas: Alerta[];
  estados: EstadoProducto[];
  resumen: { cajas: number; valor: number };
  /** El día de Lima de hoy (AAAA-MM-DD) y la temperatura de la semana: con ellos se hizo la cuenta de cada llegada. */
  hoy: string;
  lecturas: TemperaturaDia[];
  puedeRegistrar: boolean;
};

// Stock en dos pestañas (decisión del 14-11, sobre maquetas): «Qué hacer» abre con lo que tiene que salir hoy, y «Tu stock»
// guarda los totales y la lista. Antes lo principal quedaba debajo del anillo, los recuadros y la lista. En escritorio (ADR-0015)
// no hay pestañas: las dos van lado a lado.
export function TableroStock({ alertas, estados, resumen, hoy, lecturas, puedeRegistrar }: Props) {
  const [pestana, setPestana] = useState<Pestana>("hacer");
  const [elegida, setElegida] = useState<{ fruta: EstadoProducto; lote: LoteEstimado } | null>(null);
  const [abierta, setAbierta] = useState(false);
  // Lo mismo que cuentan las etiquetas rojas «Hoy» de la lista: las frutas que piden algo hoy.
  const { urgentes } = veredictoDelStock(estados);
  const ver = (fruta: EstadoProducto, lote: LoteEstimado) => {
    setElegida({ fruta, lote });
    setAbierta(true);
  };
  const verFruta = (productoId: number) => {
    const fruta = estados.find((e) => e.id === productoId);
    if (fruta?.lotes[0]) ver(fruta, fruta.lotes[0]);
  };
  // La hoja dice lo que hay ahora, no lo que había al abrirla: se busca la misma llegada (su día y cómo llegó) en lo último que
  // mandó el servidor. Con la copia de cuando se abrió, después de una merma seguía en «8 cajas» con el stock en 6 (/chaos
  // 2026-11-14). Si esa llegada ya no tiene cajas, la hoja baja; la copia solo sirve para que no baje vacía.
  const frutaAhora = elegida ? estados.find((e) => e.id === elegida.fruta.id) : undefined;
  const loteAhora = elegida ? frutaAhora?.lotes.find((l) => l.dia === elegida.lote.dia && l.estado === elegida.lote.estado) : undefined;
  const vista = frutaAhora && loteAhora ? { fruta: frutaAhora, lote: loteAhora } : elegida;
  return (
    <>
      <div className="vidrio rounded-full p-1 lg:hidden">
        <Segmento
          etiqueta="Qué ver de tu stock"
          valor={pestana}
          alCambiar={setPestana}
          opciones={[
            { valor: "hacer", etiqueta: "Qué hacer", cuenta: urgentes > 0 ? urgentes : undefined, urgente: true },
            { valor: "stock", etiqueta: "Tu stock" },
          ]}
        />
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className={cn(pestana !== "hacer" && "hidden lg:block")}>
          <QueHacer alertas={alertas} estados={estados} hoy={hoy} lecturas={lecturas} puedeRegistrar={puedeRegistrar} alVerFruta={verFruta} />
        </div>
        <div className={cn(pestana !== "stock" && "hidden lg:block")}>
          <ListaStock estados={estados} resumen={resumen} hoy={hoy} puedeRegistrar={puedeRegistrar} alVer={ver} />
        </div>
      </div>
      {/* Queda montada con la última llegada vista: así la hoja baja con su contenido en vez de vaciarse al cerrar. */}
      {vista && <HojaPorQue abierta={abierta && loteAhora !== undefined} alCambiar={setAbierta} fruta={vista.fruta} lote={vista.lote} hoy={hoy} puedeRegistrar={puedeRegistrar} />}
    </>
  );
}
