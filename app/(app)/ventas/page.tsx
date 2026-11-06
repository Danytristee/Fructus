import type { Metadata } from "next";
import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { HistorialVentas, type DiaVentas } from "@/components/ventas/HistorialVentas";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { etiquetaDeDia } from "@/lib/ficha-cliente-reglas";
import { diaDeLima } from "@/lib/formato";
import { deVenta, type Medio } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";
import { leerFilasDeVentas } from "@/lib/ventas";
import { resumirVentas } from "@/lib/ventas-reglas";

export const metadata: Metadata = { title: "Ventas · Fructus" };

const DIA_MS = 86_400_000;

// Cuántas ventas muestra la lista (para no cargar de más). Los totales de arriba NO salen de ella: cuentan todas las del período.
const LIMITE_LISTA = 300;

const nombreFruta = (p: { nombre: string; variedad: string | null } | null) => (p ? [p.nombre, p.variedad].filter(Boolean).join(" ") : "Fruta");

// El historial de ventas de los últimos 7 días, agrupado por día de Lima, de la más reciente a la más antigua. Cada venta trae
// todo su detalle (fruta, precios, quién la registró) para abrirlo al tocarla sin pedir nada más. La lista muestra a lo sumo las
// últimas LIMITE_LISTA; los totales salen de una lectura aparte de todas las ventas del rango, para que nunca queden bajos.
async function Historial() {
  const { supabase, permisos } = await exigirSesion();
  // Sin saber el rol no se decide qué botones hay: si la base no respondió, se dice que no hubo conexión (lib/sesion.ts: «sin-conexion»).
  if (!permisos) return <SesionSinConexion />;
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 7 * DIA_MS).toISOString();
  const [lista, filasDeResumen] = await Promise.all([
    supabase
      .from("ventas")
      .select(
        "id, fecha, total, condicion, medio_pago, estado, motivo_anulacion, anulada_en, cliente:clientes(id, nombre), registrador:perfiles!registrado_por(nombre), anulador:perfiles!anulada_por(nombre), items:venta_items(cantidad, precio_unitario, descuento, subtotal, producto:productos(nombre, variedad))",
      )
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(LIMITE_LISTA),
    leerFilasDeVentas(supabase, desde).catch((e: unknown) => {
      console.error("ventas: no se pudo leer el resumen", { error: e instanceof Error ? e.message : "desconocido" });
      return null;
    }),
  ]);
  const { data, error } = lista;
  if (error || !filasDeResumen) {
    console.error("ventas: no se pudo leer el historial", { codigo: error?.code });
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
    const anulada = v.estado === "anulada";
    porDia.get(dia)!.ventas.push({
      ...op,
      estado: anulada ? "anulada" : op.estado,
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
        anulacion: anulada ? { cuando: v.anulada_en ?? v.fecha, por: v.anulador?.nombre ?? null, motivo: v.motivo_anulacion ?? "" } : null,
      },
    });
  }
  const hoy = diaDeLima(ahora);
  const { resumenes, filas, porDia: deCadaDia } = resumirVentas(filasDeResumen, hoy, (fecha) => diaDeLima(new Date(fecha)));
  return <HistorialVentas dias={[...porDia.values()]} hoy={hoy} puedeAnular={permisos.anular} resumenes={resumenes} filas={filas} deCadaDia={deCadaDia} />;
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
