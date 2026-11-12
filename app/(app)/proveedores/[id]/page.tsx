import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { HistorialCliente } from "@/components/clientes/HistorialCliente";
import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { DatosProveedor } from "@/components/proveedores/DatosProveedor";
import { FrutasDelProveedor } from "@/components/proveedores/FrutasDelProveedor";
import { TarjetaNegociacion } from "@/components/proveedores/TarjetaNegociacion";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { HISTORIAL_TOPE, historialDelProveedor } from "@/lib/ficha-proveedor-reglas";
import { palancas } from "@/lib/negociacion-reglas";
import { iniciales, tonoDe, type Medio } from "@/lib/operaciones-reglas";
import { leerProveedores } from "@/lib/proveedores";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Proveedor · Fructus" };

const VOLVER = { href: "/proveedores", texto: "Proveedores" };

type Proveedor = {
  id: number;
  nombre: string;
  alias: string[];
  ruc: string | null;
  telefono: string | null;
  contacto: string | null;
  origen: string | null;
  direccion: string | null;
  notas: string | null;
};

type Sesion = Awaited<ReturnType<typeof exigirSesion>>["supabase"];

/** Todo lo que pinta la ficha. Un fallo de la base se lanza: quien llama lo dice en lenguaje de puesto. */
async function leerFicha(supabase: Sesion, proveedor: Proveedor) {
  const [{ analisis }, compras, pagos] = await Promise.all([
    leerProveedores(supabase),
    supabase
      .from("compras")
      .select("id, fecha, total, condicion, items:compra_items(cantidad, producto:productos(nombre, variedad, seleccion, calibre))")
      .eq("proveedor_id", proveedor.id)
      .order("fecha", { ascending: false })
      .limit(HISTORIAL_TOPE + 1),
    supabase
      .from("pagos_proveedor")
      .select("id, fecha, monto, medio_pago, nota")
      .eq("proveedor_id", proveedor.id)
      .order("fecha", { ascending: false })
      .limit(HISTORIAL_TOPE + 1),
  ]);
  const fallo = compras.error ?? pagos.error;
  if (fallo) throw new Error(`historial (${fallo.code})`);
  const a = analisis.find((x) => x.id === proveedor.id);
  if (!a) throw new Error("el proveedor no salió en el análisis");

  const nombreDe: Record<number, string> = Object.fromEntries(analisis.map((x) => [x.id, x.nombre]));
  const historial = historialDelProveedor(
    {
      compras: (compras.data ?? []).map((c) => ({
        id: c.id,
        fecha: c.fecha,
        total: Number(c.total),
        condicion: c.condicion,
        proveedor: { nombre: proveedor.nombre },
        items: c.items.map((i) => ({ cantidad: Number(i.cantidad), producto: i.producto })),
      })),
      pagos: (pagos.data ?? []).map((p) => ({ id: p.id, fecha: p.fecha, monto: Number(p.monto), medio: p.medio_pago as Medio, nota: p.nota })),
    },
    new Date(),
  );
  return { a, nombreDe, historial };
}

// Qué te conviene hacer con él, lo que te trae frente a otros, cómo hablarle y su historial. Todo sale de tus compras y tus pagos.
async function Cuenta({ proveedor }: { proveedor: Proveedor }) {
  const { supabase, permisos } = await exigirSesion();
  if (!permisos) return <SesionSinConexion />;
  const ficha = await leerFicha(supabase, proveedor).catch((error: Error) => {
    console.error("proveedores: no se pudo leer la ficha", { proveedorId: proveedor.id, mensaje: error.message });
    return null;
  });
  if (!ficha) {
    return (
      <Aviso titulo="No pudimos leer su cuenta" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  const { a, nombreDe, historial } = ficha;
  const principal = a.frutas[0]?.fruta.toLowerCase();
  const mensaje = `Hola${proveedor.contacto ? ` ${proveedor.contacto}` : ""}, ¿a cómo tienes hoy ${principal ?? "la fruta"}?`;

  // En escritorio (ADR-0015): el veredicto y sus datos a la izquierda, fijos al deslizar; sus frutas y su historial a la derecha.
  return (
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-8 lg:col-span-5">
        <TarjetaNegociacion analisis={a} palancas={palancas(a, (id) => nombreDe[id] ?? "Otro")} iniciales={iniciales(a.nombre)} tono={tonoDe(a.id)} />
        <DatosProveedor
          contacto={proveedor.contacto}
          telefono={proveedor.telefono}
          ruc={proveedor.ruc}
          origen={proveedor.origen}
          direccion={proveedor.direccion}
          notas={proveedor.notas}
          mensaje={mensaje}
        />
      </div>
      <div className="lg:col-span-7 lg:[&>*:first-child]:mt-0">
        <FrutasDelProveedor frutas={a.frutas} nombreDe={nombreDe} />
        <HistorialCliente dias={historial.dias} hayMas={historial.hayMas} tope={HISTORIAL_TOPE} vacio="Cuando le compres o le pagues, aparece aquí." />
      </div>
    </div>
  );
}

export default async function FichaProveedor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El proveedor se lee antes de pintar nada: así un enlace roto responde 404 de verdad, y no un 200 con «no existe».
  if (!/^\d{1,15}$/.test(id)) notFound();
  const { supabase } = await exigirSesion();
  const { data: proveedor, error } = await supabase
    .from("proveedores")
    .select("id, nombre, alias, ruc, telefono, contacto, origen, direccion, notas")
    .eq("id", Number(id))
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("proveedores: no se pudo leer al proveedor", { proveedorId: id, codigo: error.code });
    return (
      <>
        <Encabezado titulo="Proveedor" volver={VOLVER} />
        <Aviso titulo="No pudimos abrir su ficha" accion={<BotonReintentar />}>
          Revisa tu señal. Lo que ya guardaste está a salvo.
        </Aviso>
      </>
    );
  }
  if (!proveedor) notFound();

  const apodos = proveedor.alias.slice(0, 2).map((a) => `«${a}»`).join(" ");
  return (
    <>
      <Encabezado titulo={proveedor.nombre} subtitulo={apodos || undefined} volver={VOLVER} sobreTarjeta />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando su cuenta">
            <Esqueleto className="h-[240px] rounded-protagonista" />
            <Esqueleto className="h-16" />
            <Esqueleto className="h-[300px]" />
          </div>
        }
      >
        <Cuenta proveedor={proveedor} />
      </Suspense>
    </>
  );
}
