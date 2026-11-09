import type { Metadata } from "next";
import { Suspense } from "react";

import { EnviarCierre } from "@/components/cierre/EnviarCierre";
import { ExportarMes } from "@/components/cierre/ExportarMes";
import { PanelCierre } from "@/components/cierre/PanelCierre";
import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { calcularCierre, type Medio } from "@/lib/cierre-reglas";
import { mesesParaExportar } from "@/lib/exportar-reglas";
import { formatearFecha } from "@/lib/formato";
import { inicioDelDiaLima } from "@/lib/hoy-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Cierre del día · Fructus" };

// Lee lo que entró y salió hoy y lo pasa por lib/cierre-reglas.ts. Debajo, el Excel del mes: va dentro del mismo Suspense para que
// no aparezca antes que el resumen y se corra hacia abajo cuando este llegue. Se ofrece aunque el día no se haya podido leer.
async function Resumen() {
  const { supabase } = await exigirSesion();
  const excel = <ExportarMes meses={mesesParaExportar(new Date())} />;
  const desde = inicioDelDiaLima(new Date());
  const [ventas, abonos, gastos, compras] = await Promise.all([
    supabase.from("ventas").select("total, condicion, medio_pago").eq("estado", "registrada").gte("fecha", desde),
    supabase.from("abonos").select("monto, medio_pago").gte("fecha", desde),
    supabase.from("gastos").select("monto, medio_pago").gte("fecha", desde),
    supabase.from("compras").select("total, medio_pago").eq("condicion", "contado").gte("fecha", desde),
  ]);
  const error = ventas.error ?? abonos.error ?? gastos.error ?? compras.error;
  if (error) {
    console.error("cierre: no se pudo leer el día", { codigo: error.code });
    return (
      <div className="grid grid-cols-1 gap-2.5">
        <Aviso titulo="No pudimos leer tu día" accion={<BotonReintentar />}>
          Revisa tu señal. Lo que ya guardaste está a salvo.
        </Aviso>
        {excel}
      </div>
    );
  }
  const medio = (m: string | null) => m as Medio | null;
  const cierre = calcularCierre({
    ventasContado: (ventas.data ?? []).filter((v) => v.condicion === "contado").map((v) => ({ monto: Number(v.total), medio: medio(v.medio_pago) })),
    ventasCredito: (ventas.data ?? []).filter((v) => v.condicion === "credito").map((v) => Number(v.total)),
    abonos: (abonos.data ?? []).map((a) => ({ monto: Number(a.monto), medio: medio(a.medio_pago) })),
    gastos: (gastos.data ?? []).map((g) => ({ monto: Number(g.monto), medio: medio(g.medio_pago) })),
    compras: (compras.data ?? []).map((c) => ({ monto: Number(c.total), medio: medio(c.medio_pago) })),
  });
  // grid-cols-1 es una columna de ancho fijo (minmax(0, 1fr)): el botón de WhatsApp y la tarjeta del Excel miden lo que mide la pantalla aunque el
  // resumen de arriba, con importes de cinco cifras, se ensanche (ver «Pendiente» en docs/bitacora/2026-11-08-exportar-excel.md).
  return (
    <div className="grid grid-cols-1 gap-2.5">
      <PanelCierre c={cierre} />
      <EnviarCierre c={cierre} />
      {excel}
    </div>
  );
}

export default async function Cierre() {
  const { permisos } = await exigirSesion();
  if (!permisos) {
    return (
      <>
        <Encabezado titulo="Cierre del día" />
        <SesionSinConexion />
      </>
    );
  }
  if (!permisos.cierre) {
    return (
      <>
        <Encabezado titulo="Cierre del día" />
        <Aviso titulo="No tienes acceso al cierre del día">Pídele al dueño que revise tu cuenta.</Aviso>
      </>
    );
  }
  return (
    <>
      <Encabezado titulo="Cierre del día" subtitulo={formatearFecha(new Date())} sobreTarjeta />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando el cierre">
            <Esqueleto className="h-[170px] rounded-protagonista" />
            <Esqueleto className="h-[130px]" />
            <Esqueleto className="h-[220px]" />
            <Esqueleto className="h-[330px]" />
          </div>
        }
      >
        <Resumen />
      </Suspense>
    </>
  );
}
