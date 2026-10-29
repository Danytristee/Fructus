import type { Metadata } from "next";
import { Suspense } from "react";

import { ResumenInventario } from "@/components/inventario/ResumenInventario";
import { TableroStock } from "@/components/inventario/TableroStock";
import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { leerInventario } from "@/lib/inventario";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Stock · Fructus" };

// El dashboard inteligente de inventario: existencias, frescura de cada lote, demanda y alertas con su recomendación.
async function Tablero() {
  const { supabase } = await exigirSesion();
  const inventario = await leerInventario(supabase).catch((e: unknown) => {
    console.error("stock: no se pudo leer el inventario", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  });
  if (!inventario) {
    return (
      <Aviso titulo="No pudimos leer tu stock" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  return (
    <>
      <ResumenInventario resumen={inventario.resumen} estados={inventario.estados} />
      <TableroStock alertas={inventario.alertas} estados={inventario.estados} />
    </>
  );
}

export default function Stock() {
  return (
    <>
      <Encabezado titulo="Stock" subtitulo="Tus cajas y lo que conviene hacer hoy" />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando tu stock">
            <Esqueleto className="h-[140px] rounded-protagonista" />
            <Esqueleto className="h-[120px]" />
            <Esqueleto className="h-[320px]" />
          </div>
        }
      >
        <Tablero />
      </Suspense>
    </>
  );
}
