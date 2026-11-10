import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { AvisoInventario } from "@/components/hoy/AvisoInventario";
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
      <Suspense fallback={<EsqueletoResumen />}>
        <ResumenDia />
      </Suspense>
      {/* En escritorio (ADR-0015): «Lo último» a la izquierda y el aviso de stock al lado, alineado con la lista. En celular, uno debajo del otro,
          el aviso primero. */}
      <div className="lg:mt-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4">
        <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:pt-[60px]">
          {/* Sin esqueleto: si no hay alertas no ocupa lugar, y si las hay aparece con su animación. */}
          <Suspense fallback={null}>
            <AvisoInventario />
          </Suspense>
        </div>
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
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
