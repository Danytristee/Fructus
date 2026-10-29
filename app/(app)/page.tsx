import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
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
  return (
    <>
      <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} />
      <Suspense fallback={<EsqueletoResumen />}>
        <ResumenDia />
      </Suspense>
      {/* Sin esqueleto: si no hay alertas no ocupa lugar, y si las hay aparece con su animación. */}
      <Suspense fallback={null}>
        <AvisoInventario />
      </Suspense>
      <Suspense fallback={<EsqueletoUltimas />}>
        <UltimasOperaciones />
      </Suspense>
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
