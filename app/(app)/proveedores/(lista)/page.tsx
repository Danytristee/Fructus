import type { Metadata } from "next";
import { Suspense } from "react";

import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { ListaProveedores, type FilaProveedor } from "@/components/proveedores/ListaProveedores";
import { TarjetaDependencia } from "@/components/proveedores/TarjetaDependencia";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { TITULOS } from "@/lib/negociacion-reglas";
import { AHORRO_MINIMO } from "@/lib/proveedores-reglas";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { leerProveedores } from "@/lib/proveedores";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Proveedores · Fructus" };

// A quién le compras, de quién dependes y qué le puedes pedir a cada uno. Todo sale de tus compras (lib/proveedores-reglas.ts).
async function Tablero() {
  const { supabase, permisos } = await exigirSesion();
  if (!permisos) return <SesionSinConexion />;
  let leido;
  try {
    leido = await leerProveedores(supabase);
  } catch (error) {
    console.error("proveedores: no se pudo leer el tablero", { mensaje: (error as Error).message });
    return (
      <Aviso titulo="No pudimos leer tus proveedores" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  const { analisis, resumen, datos } = leido;
  const filas: FilaProveedor[] = analisis.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    apodo: datos.get(a.id)?.alias[0] ?? null,
    origen: datos.get(a.id)?.origen ?? null,
    iniciales: iniciales(a.nombre),
    tono: tonoDe(a.id),
    participacion: a.participacion,
    saldo: a.saldo,
    posicion: a.posicion,
    titulo: TITULOS[a.posicion],
    masCaro: a.ahorroMensual >= AHORRO_MINIMO,
    sinCompras: a.total === 0,
  }));

  return (
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-8 lg:col-span-5">
        <TarjetaDependencia resumen={resumen} analisis={analisis} />
      </div>
      <div className="lg:col-span-7 lg:[&>section]:mt-0">
        <ListaProveedores proveedores={filas} />
      </div>
    </div>
  );
}

export default function Proveedores() {
  return (
    <>
      <Encabezado titulo="Proveedores" subtitulo="A quién le compras y qué le puedes pedir" sobreTarjeta />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando tus proveedores">
            <Esqueleto className="h-[260px] rounded-protagonista" />
            <Esqueleto className="h-14 rounded-full" />
            <Esqueleto className="h-[360px]" />
          </div>
        }
      >
        <Tablero />
      </Suspense>
    </>
  );
}
