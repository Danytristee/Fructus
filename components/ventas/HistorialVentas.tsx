"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";

import { FilaOperacion } from "@/components/hoy/FilaOperacion";
import { Desplegable } from "@/components/ui/Desplegable";
import { Filtros } from "@/components/ui/Filtros";
import { Monto } from "@/components/ui/Monto";
import { Vacio } from "@/components/ui/Vacio";
import type { Operacion } from "@/lib/operaciones-reglas";

export type DiaVentas = { dia: string; etiqueta: string; ventas: (Operacion & { credito: boolean })[] };
type Filtro = "todas" | "contado" | "credito";

// Las ventas de la semana, día por día: cada día se abre y se cierra, y se filtra por contado o crédito.
export function HistorialVentas({ dias }: { dias: DiaVentas[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const todas = dias.flatMap((d) => d.ventas);
  const pasa = (v: { credito: boolean }) => filtro === "todas" || (filtro === "credito" ? v.credito : !v.credito);
  const visibles = dias.map((d) => ({ ...d, ventas: d.ventas.filter(pasa) })).filter((d) => d.ventas.length > 0);

  return (
    <section aria-labelledby="historial">
      <h2 id="historial" className="sr-only">
        Ventas de la semana
      </h2>
      <Filtros
        etiqueta="Filtrar ventas"
        valor={filtro}
        alCambiar={setFiltro}
        opciones={[
          { valor: "todas", etiqueta: "Todas", cuenta: todas.length },
          { valor: "contado", etiqueta: "Al contado", cuenta: todas.filter((v) => !v.credito).length },
          { valor: "credito", etiqueta: "Al crédito", cuenta: todas.filter((v) => v.credito).length },
        ]}
      />
      {visibles.length === 0 ? (
        <Vacio className="mt-3" icono={<Receipt />} titulo="No hay ventas así">
          Cambia el filtro para ver las demás.
        </Vacio>
      ) : (
        <div key={filtro} className="mt-3 grid gap-2.5">
          {visibles.map((d, i) => {
            const total = d.ventas.reduce((s, v) => s + (v.monto ?? 0), 0);
            return (
              <div key={d.dia} className="vidrio animate-subir rounded-tarjeta px-4 py-1" style={{ animationDelay: `${i * 50}ms` }}>
                <Desplegable
                  abiertoAlInicio={i === 0}
                  resumen={
                    <span className="flex items-center justify-between gap-3">
                      <span className="grid">
                        <span className="font-extrabold capitalize">{d.etiqueta}</span>
                        <span className="text-base text-texto-suave">
                          {d.ventas.length} {d.ventas.length === 1 ? "venta" : "ventas"}
                        </span>
                      </span>
                      <Monto valor={total} />
                    </span>
                  }
                >
                  <ul className="-mx-4 divide-y divide-border border-t border-border">
                    {d.ventas.map((v) => (
                      <FilaOperacion key={v.clave} op={v} />
                    ))}
                  </ul>
                </Desplegable>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
