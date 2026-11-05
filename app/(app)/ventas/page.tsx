import type { Metadata } from "next";
import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { HistorialVentas, type DiaVentas } from "@/components/ventas/HistorialVentas";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { etiquetaDeDia } from "@/lib/ficha-cliente-reglas";
import { diaDeLima } from "@/lib/formato";
import { deVenta, type Medio } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ventas · Fructus" };

const DIA_MS = 86_400_000;

const nombreFruta = (p: { nombre: string; variedad: string | null } | null) => (p ? [p.nombre, p.variedad].filter(Boolean).join(" ") : "Fruta");

// El historial de ventas de los últimos 7 días, agrupado por día de Lima, de la más reciente a la más antigua. Cada venta trae
// todo su detalle (fruta, precios, quién la registró) para abrirlo al tocarla sin pedir nada más.
async function Historial() {
  const { supabase } = await exigirSesion();
  const ahora = new Date();
  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, fecha, total, condicion, medio_pago, cliente:clientes(id, nombre), registrador:perfiles!registrado_por(nombre), items:venta_items(cantidad, precio_unitario, descuento, subtotal, producto:productos(nombre, variedad))",
    )
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
    if (!porDia.has(dia)) porDia.set(dia, { dia, etiqueta: etiquetaDeDia(fecha, ahora), ventas: [] });
    const medio = v.medio_pago as Medio | null;
    const op = deVenta({
      id: v.id,
      fecha: v.fecha,
      total: Number(v.total),
      condicion: v.condicion,
      medio,
      cliente: v.cliente,
      items: v.items.map((i) => ({ cantidad: Number(i.cantidad), producto: i.producto })),
    });
    porDia.get(dia)!.ventas.push({
      ...op,
      credito: v.condicion === "credito",
      completa: {
        id: v.id,
        fecha: v.fecha,
        total: Number(v.total),
        condicion: v.condicion,
        medio,
        cliente: v.cliente,
        items: v.items.map((i) => ({
          producto: nombreFruta(i.producto),
          cantidad: Number(i.cantidad),
          precio: Number(i.precio_unitario),
          descuento: Number(i.descuento),
          subtotal: Number(i.subtotal),
        })),
        registradaPor: v.registrador?.nombre ?? null,
      },
    });
  }
  return <HistorialVentas dias={[...porDia.values()]} hoy={diaDeLima(ahora)} />;
}

export default function Ventas() {
  return (
    <>
      <Encabezado titulo="Ventas" subtitulo="Lo que vendiste, venta por venta" />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando tus ventas">
            <Esqueleto className="h-[150px] rounded-protagonista" />
            <Esqueleto className="h-12 rounded-full" />
            <Esqueleto className="h-[420px]" />
          </div>
        }
      >
        <Historial />
      </Suspense>
    </>
  );
}
