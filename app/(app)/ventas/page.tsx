import type { Metadata } from "next";
import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { HistorialVentas, type DiaVentas } from "@/components/ventas/HistorialVentas";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { diaDeLima, formatearFecha, formatearHace } from "@/lib/formato";
import { deVenta, type Medio } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ventas · Fructus" };

const DIA_MS = 86_400_000;

// El historial de ventas de los últimos 7 días, agrupado por día de Lima, de la más reciente a la más antigua.
async function Historial() {
  const { supabase } = await exigirSesion();
  const ahora = new Date();
  const { data, error } = await supabase
    .from("ventas")
    .select("id, fecha, total, condicion, medio_pago, cliente:clientes(id, nombre), items:venta_items(cantidad, producto:productos(nombre, variedad))")
    .eq("estado", "registrada")
    .gte("fecha", new Date(ahora.getTime() - 7 * DIA_MS).toISOString())
    .order("fecha", { ascending: false })
    .limit(300);
  if (error) {
    console.error("ventas: no se pudo leer el historial", { codigo: error.code });
    return (
      <Aviso titulo="No pudimos leer tus ventas" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  const porDia = new Map<string, DiaVentas>();
  for (const v of data ?? []) {
    const fecha = new Date(v.fecha);
    const dia = diaDeLima(fecha);
    const hace = formatearHace(fecha, ahora);
    if (!porDia.has(dia)) porDia.set(dia, { dia, etiqueta: hace === "hoy" || hace === "ayer" ? hace : formatearFecha(fecha), ventas: [] });
    const op = deVenta({
      id: v.id,
      fecha: v.fecha,
      total: Number(v.total),
      condicion: v.condicion,
      medio: v.medio_pago as Medio | null,
      cliente: v.cliente,
      items: v.items.map((i) => ({ cantidad: Number(i.cantidad), producto: i.producto })),
    });
    porDia.get(dia)!.ventas.push({ ...op, credito: v.condicion === "credito" });
  }
  return <HistorialVentas dias={[...porDia.values()]} />;
}

export default function Ventas() {
  return (
    <>
      <Encabezado titulo="Ventas" subtitulo="Lo que vendiste en la semana" />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando tus ventas">
            <Esqueleto className="h-12 rounded-full" />
            <Esqueleto className="h-[420px]" />
            <Esqueleto className="h-16" />
          </div>
        }
      >
        <Historial />
      </Suspense>
    </>
  );
}
