import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { EsqueletoResumen, EsqueletoUltimas } from "@/components/hoy/EsqueletoResumen";
import { ResumenDia } from "@/components/hoy/ResumenDia";
import { UltimasOperaciones } from "@/components/hoy/UltimasOperaciones";
import { formatearFecha } from "@/lib/formato";

// «Hoy»: la pantalla del dueño. El encabezado sale al toque; el resumen y lo último llegan detrás, cada uno con su esqueleto.
export default function Hoy() {
  return (
    <>
      <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} />
      <Suspense fallback={<EsqueletoResumen />}>
        <ResumenDia />
      </Suspense>
      <Suspense fallback={<EsqueletoUltimas />}>
        <UltimasOperaciones />
      </Suspense>
    </>
  );
}
