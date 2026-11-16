import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { EsqueletoResumen, EsqueletoUltimas } from "@/components/hoy/EsqueletoResumen";
import { ResumenDia } from "@/components/hoy/ResumenDia";
import { UltimasOperaciones } from "@/components/hoy/UltimasOperaciones";
import { VozHoy } from "@/components/voz/VozHoy";
import { formatearFecha } from "@/lib/formato";
import { exigirSesion } from "@/lib/sesion";

// «Hoy»: la pantalla del dueño. El encabezado sale al toque; el resumen y lo último llegan detrás, cada uno con su esqueleto.
export default async function Hoy() {
  // El contador solo lee: no ve el botón de voz (permisosDe en lib/permisos-reglas.ts).
  const { permisos } = await exigirSesion();
  // Sin saber el rol no se decide si hay botón de voz: se dice que no hubo conexión en vez de esconderlo en silencio.
  if (!permisos) {
    return (
      <>
        <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} marca />
        <SesionSinConexion />
      </>
    );
  }
  return (
    <>
      <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} marca sobreTarjeta />
      {/* Una sola grilla. En celular, de arriba abajo: lo vendido, lo que el puesto pide hoy, lo cobrado y lo último. En escritorio
          (ADR-0015): lo vendido y lo cobrado arriba; «Lo último» debajo a la izquierda, con los avisos al lado. El margen de
          «Lo último» más el espacio de la grilla dan los 24 px de siempre. */}
      <div className="grid gap-2.5 lg:grid-cols-12 lg:items-start lg:gap-4">
        <Suspense fallback={<EsqueletoResumen />}>
          {/* El contador solo lee: no se le pide la temperatura. */}
          <ResumenDia pideTemperatura={permisos.registrar} />
        </Suspense>
        <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-2">
          <Suspense fallback={<EsqueletoUltimas />}>
            <UltimasOperaciones />
          </Suspense>
        </div>
      </div>
      {permisos.registrar && (
        <>
          {/* Espacio para que la última fila suba por encima del orbe y su etiqueta. */}
          <div aria-hidden className="h-16" />
          <VozHoy />
        </>
      )}
    </>
  );
}
