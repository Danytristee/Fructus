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
import { etiquetaDelPeriodo, type DetalleVenta, type Periodo, type ResumenDeDia, type ResumenPeriodo } from "@/lib/ventas-reglas";

/** La fila (`Operacion`, con su `detalle` de una línea) y, aparte, la venta completa (`completa`) para su hoja. */
// La hoja del detalle (con el flujo de anular) llega en diferido: no pesa en la primera carga. Se pide por detrás apenas la pantalla
// queda lista, para que al tocar una venta suba sin esperar.
const cargarHoja = () => import("./HojaVenta").then((m) => m.HojaVenta);
const HojaVenta = dynamic(cargarHoja, { ssr: false });

type VentaDelDia = Operacion & { credito: boolean; completa: DetalleVenta };
export type DiaVentas = { dia: string; etiqueta: string; ventas: VentaDelDia[] };
type Filtro = "todas" | "contado" | "credito";

type Props = {
  dias: DiaVentas[];
  hoy: string;
  puedeAnular: boolean;
  /** Lo vendido en cada período, contando TODAS las ventas (la lista de `dias` puede estar cortada en las últimas N). */
  resumenes: Record<Periodo, ResumenPeriodo>;
  /** Cuántas ventas hay en cada período, anuladas incluidas: si son más que las de la lista, se dice. */
  filas: Record<Periodo, number>;
  /** Lo de cada día, completo, para su cabecera. */
  deCadaDia: Record<string, ResumenDeDia>;
};

// El historial de ventas: lo de hoy o lo de los últimos 7 días, con cuánto se vendió arriba, día por día, filtrado por contado
// o crédito. Tocar una venta abre su detalle. Los totales y los conteos salen de TODAS las ventas del período, no de la lista.
export function HistorialVentas({ dias, hoy, puedeAnular, resumenes, filas, deCadaDia }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<DetalleVenta | null>(null);

  useEffect(() => {
    void cargarHoja();
  }, []);

  const delPeriodo = periodo === "hoy" ? dias.filter((d) => d.dia === hoy) : dias;
  const resumen = resumenes[periodo]; // lo anulado se ve en la lista, pero no cuenta
  const pasa = (v: { credito: boolean }) => filtro === "todas" || (filtro === "credito" ? v.credito : !v.credito);
  const visibles = delPeriodo.map((d) => ({ ...d, ventas: d.ventas.filter(pasa) })).filter((d) => d.ventas.length > 0);
  const mostradas = delPeriodo.reduce((n, d) => n + d.ventas.length, 0);

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
            : (
              <>
                {resumen.ventas} {resumen.ventas === 1 ? "venta" : "ventas"}:{" "}
                <strong className="cifra font-extrabold text-texto">{formatearSoles(resumen.contado)}</strong> al contado y{" "}
                <strong className="cifra font-extrabold text-texto">{formatearSoles(resumen.credito)}</strong> al crédito
              </>
            )}
        </span>
      </Tarjeta>

      <Filtros
        etiqueta="Período"
        valor={periodo}
        alCambiar={setPeriodo}
        opciones={[
          { valor: "hoy", etiqueta: "Hoy", cuenta: resumenes.hoy.ventas },
          { valor: "semana", etiqueta: "7 días", cuenta: resumenes.semana.ventas },
        ]}
      />
      <div className="mt-2">
        <Filtros
          etiqueta="Filtrar ventas"
          valor={filtro}
          alCambiar={setFiltro}
          opciones={[
            { valor: "todas", etiqueta: "Todas", cuenta: resumen.ventas },
            { valor: "contado", etiqueta: "Contado", cuenta: resumen.ventasContado },
            { valor: "credito", etiqueta: "Crédito", cuenta: resumen.ventasCredito },
          ]}
        />
      </div>

      {visibles.length === 0 ? (
        <Vacio className="mt-3" icono={<Receipt />} titulo={resumen.ventas === 0 ? "Todavía no hay ventas" : "No hay ventas así"}>
          {resumen.ventas === 0 ? "Cuando vendas, aparecen aquí, venta por venta." : "Cambia el filtro para ver las demás."}
        </Vacio>
      ) : (
        <div key={`${periodo}-${filtro}`} className="mt-3 grid gap-2.5">
          {visibles.map((d, i) => {
            const { ventas: nVentas, anuladas, total } = deCadaDia[d.dia] ?? { ventas: 0, anuladas: 0, total: 0 };
            return (
              <div key={d.dia} className="vidrio animate-subir rounded-tarjeta px-4 py-1" style={{ animationDelay: `${i * 50}ms` }}>
                <Desplegable
                  abiertoAlInicio={i === 0}
                  resumen={
                    <span className="flex items-center justify-between gap-3">
                      <span className="grid">
                        <span className="font-extrabold capitalize">{d.etiqueta}</span>
                        <span className="text-base text-texto-suave">
                          {nVentas} {nVentas === 1 ? "venta" : "ventas"}
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
          <ListaCortada mostradas={mostradas} total={filas[periodo]} periodo={periodo} />
        </div>
      )}

      <HojaVenta venta={abierta} puedeAnular={puedeAnular} alCerrar={() => setAbierta(null)} />
    </section>
  );
}

// Si la lista no trae todas las ventas del período (se corta en las últimas N), lo dice. Los totales de arriba sí cuentan todas.
function ListaCortada({ mostradas, total, periodo }: { mostradas: number; total: number; periodo: Periodo }) {
  if (total <= mostradas) return null;
  return (
    <p role="note" className="px-2 text-center text-texto-suave">
      Mostrando las últimas {mostradas} ventas de las {total} {periodo === "hoy" ? "de hoy" : "de estos 7 días"}. Los totales de arriba cuentan todas.
    </p>
  );
}
