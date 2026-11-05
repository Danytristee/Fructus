import type { Metadata } from "next";
import { Suspense } from "react";

import { CompraAMano } from "@/components/inventario/CompraAMano";
import { MermaAMano } from "@/components/inventario/MermaAMano";
import { ResumenInventario } from "@/components/inventario/ResumenInventario";
import { TableroStock } from "@/components/inventario/TableroStock";
import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { BarraFlotante } from "@/components/ui/BarraFlotante";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { sugeridosParaCompra, sugeridosParaMerma } from "@/lib/a-mano-reglas";
import { leerInventario } from "@/lib/inventario";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Stock · Fructus" };

// El dashboard inteligente de inventario: existencias, frescura de cada lote, demanda y alertas con su recomendación.
async function Tablero() {
  const { supabase, permisos } = await exigirSesion();
  const inventario = await leerInventario(supabase).catch((e: unknown) => {
    console.error("stock: no se pudo leer el inventario", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  });
  // A quién ofrecer primero al registrar una compra. Si no se pueden leer, la hoja igual busca por nombre.
  const { data: lista } = permisos.registrar ? await supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre").limit(5) : { data: [] };
  const proveedores = (lista ?? []).map((p) => ({ id: p.id, nombre: p.nombre }));
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
      <TableroStock alertas={inventario.alertas} estados={inventario.estados} puedeRegistrar={permisos.registrar} />
      {permisos.registrar && (
        <BarraFlotante>
          <CompraAMano proveedores={proveedores} frutas={sugeridosParaCompra(inventario.estados)} />
          <MermaAMano producto={null} sugeridos={sugeridosParaMerma(inventario.estados)} variante="flotante" />
        </BarraFlotante>
      )}
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
