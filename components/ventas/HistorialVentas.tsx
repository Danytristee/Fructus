"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";

import { FilaOperacion } from "@/components/hoy/FilaOperacion";
import { Desplegable } from "@/components/ui/Desplegable";
import { Filtros } from "@/components/ui/Filtros";
import { Monto } from "@/components/ui/Monto";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { Vacio } from "@/components/ui/Vacio";
import { formatearSoles } from "@/lib/formato";
import type { Operacion } from "@/lib/operaciones-reglas";
import { etiquetaDelPeriodo, resumirPeriodo, type DetalleVenta, type Periodo } from "@/lib/ventas-reglas";

/** La fila (`Operacion`, con su `detalle` de una línea) y, aparte, la venta completa (`completa`) para su hoja. */
// La hoja del detalle (con el flujo de anular) llega en diferido: no pesa en la primera carga. Se pide por detrás apenas la pantalla
// queda lista, para que al tocar una venta suba sin esperar.
const cargarHoja = () => import("./HojaVenta").then((m) => m.HojaVenta);
const HojaVenta = dynamic(cargarHoja, { ssr: false });

type VentaDelDia = Operacion & { credito: boolean; completa: DetalleVenta };
export type DiaVentas = { dia: string; etiqueta: string; ventas: VentaDelDia[] };
type Filtro = "todas" | "contado" | "credito";

// El historial de ventas: lo de hoy o lo de los últimos 7 días, con cuánto se vendió arriba, día por día, filtrado por contado
// o crédito. Tocar una venta abre su detalle.
export function HistorialVentas({ dias, hoy, puedeAnular }: { dias: DiaVentas[]; hoy: string; puedeAnular: boolean }) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<DetalleVenta | null>(null);

  useEffect(() => {
    void cargarHoja();
  }, []);

  const delPeriodo = periodo === "hoy" ? dias.filter((d) => d.dia === hoy) : dias;
  const todas = delPeriodo.flatMap((d) => d.ventas).filter((v) => v.estado !== "anulada"); // lo anulado se ve, pero no cuenta
  const resumen = resumirPeriodo(todas.map((v) => ({ total: v.monto ?? 0, credito: v.credito })));
  const pasa = (v: { credito: boolean }) => filtro === "todas" || (filtro === "credito" ? v.credito : !v.credito);
  const visibles = delPeriodo.map((d) => ({ ...d, ventas: d.ventas.filter(pasa) })).filter((d) => d.ventas.length > 0);
  const vigentes = (d: DiaVentas) => d.ventas.filter((v) => v.estado !== "anulada");
  const deLaSemana = dias.flatMap(vigentes).length;
  const deHoy = dias.filter((d) => d.dia === hoy).flatMap(vigentes).length;

  return (
    <section aria-labelledby="historial">
      <h2 id="historial" className="sr-only">
        Historial de ventas
      </h2>

      <Tarjeta protagonista className="mb-3 grid animate-subir gap-1" data-testid="resumen-periodo">
        <span className="font-bold text-texto-suave">{etiquetaDelPeriodo(periodo)}</span>
        <Monto valor={resumen.total} tamano="total" />
        <span className="text-texto-suave">
          {resumen.ventas === 0
            ? periodo === "hoy"
              ? "Todavía no hay ventas hoy"
              : "No hay ventas en estos días"
            : `${resumen.ventas} ${resumen.ventas === 1 ? "venta" : "ventas"}: ${formatearSoles(resumen.contado)} al contado y ${formatearSoles(resumen.credito)} al crédito`}
        </span>
      </Tarjeta>

      <Filtros
        etiqueta="Período"
        valor={periodo}
        alCambiar={setPeriodo}
        opciones={[
          { valor: "hoy", etiqueta: "Hoy", cuenta: deHoy },
          { valor: "semana", etiqueta: "7 días", cuenta: deLaSemana },
        ]}
      />
      <div className="mt-2">
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
      </div>

      {visibles.length === 0 ? (
        <Vacio className="mt-3" icono={<Receipt />} titulo={todas.length === 0 ? "Todavía no hay ventas" : "No hay ventas así"}>
          {todas.length === 0 ? "Cuando vendas, aparecen aquí, venta por venta." : "Cambia el filtro para ver las demás."}
        </Vacio>
      ) : (
        <div key={`${periodo}-${filtro}`} className="mt-3 grid gap-2.5">
          {visibles.map((d, i) => {
            const vigentesDelDia = d.ventas.filter((v) => v.estado !== "anulada");
            const anuladas = d.ventas.length - vigentesDelDia.length;
            const total = vigentesDelDia.reduce((s, v) => s + (v.monto ?? 0), 0);
            return (
              <div key={d.dia} className="vidrio animate-subir rounded-tarjeta px-4 py-1" style={{ animationDelay: `${i * 50}ms` }}>
                <Desplegable
                  abiertoAlInicio={i === 0}
                  resumen={
                    <span className="flex items-center justify-between gap-3">
                      <span className="grid">
                        <span className="font-extrabold capitalize">{d.etiqueta}</span>
                        <span className="text-base text-texto-suave">
                          {vigentesDelDia.length} {vigentesDelDia.length === 1 ? "venta" : "ventas"}
                          {anuladas > 0 && ` · ${anuladas} ${anuladas === 1 ? "anulada" : "anuladas"}`}
                        </span>
                      </span>
                      <Monto valor={total} />
                    </span>
                  }
                >
                  <ul className="-mx-4 divide-y divide-border border-t border-border">
                    {d.ventas.map((v) => (
                      <FilaOperacion key={v.clave} op={v} alTocar={() => setAbierta(v.completa)} />
                    ))}
                  </ul>
                </Desplegable>
              </div>
            );
          })}
        </div>
      )}

      <HojaVenta venta={abierta} puedeAnular={puedeAnular} alCerrar={() => setAbierta(null)} />
    </section>
  );
}
