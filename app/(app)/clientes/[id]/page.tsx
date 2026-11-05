import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AbonoAMano } from "@/components/clientes/AbonoAMano";
import { DatosCliente } from "@/components/clientes/DatosCliente";
import { HistorialCliente } from "@/components/clientes/HistorialCliente";
import { TarjetaDeuda } from "@/components/clientes/TarjetaDeuda";
import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { HISTORIAL_TOPE, historialDelCliente } from "@/lib/ficha-cliente-reglas";
import { iniciales, tonoDe, type Medio } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Cliente · Fructus" };

const VOLVER = { href: "/clientes", texto: "Clientes" };

type Cliente = {
  id: number;
  nombre: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
};

// Su deuda, sus datos y su historial. Todo sale de la misma verdad que el cuaderno: v_saldo_clientes, ventas y abonos.
async function Cuenta({ cliente }: { cliente: Cliente }) {
  const { supabase, permisos } = await exigirSesion();
  const [saldo, deudas, ventas, abonos] = await Promise.all([
    supabase.from("v_saldo_clientes").select("saldo, ultima_venta_credito, ultimo_abono").eq("cliente_id", cliente.id).maybeSingle(),
    supabase.from("v_saldo_clientes").select("saldo"),
    supabase
      .from("ventas")
      .select("id, fecha, total, condicion, medio_pago, items:venta_items(cantidad, producto:productos(nombre, variedad))")
      .eq("cliente_id", cliente.id)
      .eq("estado", "registrada")
      .order("fecha", { ascending: false })
      .limit(HISTORIAL_TOPE + 1),
    supabase.from("abonos").select("id, fecha, monto, medio_pago").eq("cliente_id", cliente.id).order("fecha", { ascending: false }).limit(HISTORIAL_TOPE + 1),
  ]);
  const fallo = saldo.error ?? deudas.error ?? ventas.error ?? abonos.error;
  if (fallo) {
    console.error("clientes: no se pudo leer la ficha", { clienteId: cliente.id, codigo: fallo.code });
    return (
      <Aviso titulo="No pudimos leer su cuenta" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }

  const persona = { id: cliente.id, nombre: cliente.nombre };
  const { dias, hayMas } = historialDelCliente(
    {
      ventas: (ventas.data ?? []).map((v) => ({
        id: v.id,
        fecha: v.fecha,
        total: Number(v.total),
        condicion: v.condicion,
        medio: v.medio_pago as Medio | null,
        cliente: persona,
        items: v.items.map((i) => ({ cantidad: Number(i.cantidad), producto: i.producto })),
      })),
      abonos: (abonos.data ?? []).map((a) => ({ id: a.id, fecha: a.fecha, monto: Number(a.monto), medio: a.medio_pago as Medio, cliente: persona })),
    },
    new Date(),
  );
  const deudaTotal = (deudas.data ?? []).reduce((suma, c) => suma + Math.max(0, Number(c.saldo ?? 0)), 0);

  return (
    <>
      <TarjetaDeuda
        iniciales={iniciales(cliente.nombre)}
        tono={tonoDe(cliente.id)}
        saldo={Number(saldo.data?.saldo ?? 0)}
        deudaTotal={deudaTotal}
        ultimaVentaCredito={saldo.data?.ultima_venta_credito ?? null}
        ultimoAbono={saldo.data?.ultimo_abono ?? null}
      />
      <DatosCliente
        telefono={cliente.telefono}
        documento={cliente.tipo_documento && cliente.numero_documento ? `${cliente.tipo_documento} ${cliente.numero_documento}` : null}
        direccion={cliente.direccion}
        notas={cliente.notas}
      />
      <HistorialCliente dias={dias} hayMas={hayMas} tope={HISTORIAL_TOPE} />
      {permisos.registrar && <AbonoAMano cliente={persona} />}
    </>
  );
}

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El cliente se lee antes de pintar nada: así un enlace roto responde 404 de verdad, y no un 200 con «no existe».
  if (!/^\d{1,15}$/.test(id)) notFound();
  const { supabase } = await exigirSesion();
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id, nombre, alias, tipo_documento, numero_documento, telefono, direccion, notas")
    .eq("id", Number(id))
    .maybeSingle();

  if (error) {
    console.error("clientes: no se pudo leer al cliente", { clienteId: id, codigo: error.code });
    return (
      <>
        <Encabezado titulo="Cliente" volver={VOLVER} />
        <Aviso titulo="No pudimos abrir su ficha" accion={<BotonReintentar />}>
          Revisa tu señal. Lo que ya guardaste está a salvo.
        </Aviso>
      </>
    );
  }
  if (!cliente) notFound();

  const apodos = cliente.alias.slice(0, 2).map((a) => `«${a}»`).join(" ");
  return (
    <>
      <Encabezado titulo={cliente.nombre} subtitulo={apodos || undefined} volver={VOLVER} />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando su cuenta">
            <Esqueleto className="h-[170px] rounded-protagonista" />
            <Esqueleto className="h-16" />
            <Esqueleto className="h-[300px]" />
          </div>
        }
      >
        <Cuenta cliente={cliente} />
      </Suspense>
    </>
  );
}
