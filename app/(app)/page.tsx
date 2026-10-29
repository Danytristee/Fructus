import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { EsqueletoResumen } from "@/components/hoy/EsqueletoResumen";
import { ResumenDia } from "@/components/hoy/ResumenDia";
import { formatearFecha } from "@/lib/formato";

// «Hoy»: la pantalla del dueño. El encabezado sale al toque; el resumen llega detrás, con su esqueleto mientras tanto.
export default function Hoy() {
  return (
    <>
      <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} />
      <Suspense fallback={<EsqueletoResumen />}>
        <ResumenDia />
      </Suspense>
    </>
  );
}
