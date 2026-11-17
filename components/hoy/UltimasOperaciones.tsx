import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { inicioDelDiaLima } from "@/lib/hoy-reglas";
import { deAbono, deCompra, deGasto, deMerma, deVenta, ultimas, type Medio } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";
import { FilaOperacion } from "./FilaOperacion";
import type { PartesProducto } from "@/lib/productos-reglas";

const CUANTAS = 5;

// Las 5 operaciones más recientes del día, de cualquier tipo. Se leen en paralelo y se mezclan en lib/operaciones-reglas.ts.
export async function UltimasOperaciones() {
  const { supabase } = await exigirSesion();
  const desde = inicioDelDiaLima(new Date());
  const reciente = { ascending: false } as const;

  const [ventas, abonos, compras, mermas, gastos] = await Promise.all([
    supabase
      .from("ventas")
      .select("id, fecha, total, condicion, medio_pago, cliente:clientes(id, nombre), items:venta_items(cantidad, producto:productos(nombre, variedad, seleccion, calibre))")
      .eq("estado", "registrada")
      .gte("fecha", desde)
      .order("fecha", reciente)
      .limit(CUANTAS),
    supabase.from("abonos").select("id, fecha, monto, medio_pago, venta_id, cliente:clientes(id, nombre)").gte("fecha", desde).order("fecha", reciente).limit(CUANTAS),
    supabase
      .from("compras")
      .select("id, fecha, total, proveedor:proveedores(nombre), items:compra_items(cantidad, producto:productos(nombre, variedad, seleccion, calibre))")
      .gte("fecha", desde)
      .order("fecha", reciente)
      .limit(CUANTAS),
    supabase
      .from("movimientos_stock")
      .select("id, fecha, cantidad, motivo, producto:productos(nombre, variedad, seleccion, calibre)")
      .eq("tipo", "merma")
      .gte("fecha", desde)
      .order("fecha", reciente)
      .limit(CUANTAS),
    supabase.from("gastos").select("id, fecha, monto, categoria, descripcion").gte("fecha", desde).order("fecha", reciente).limit(CUANTAS),
  ]);

  const error = ventas.error ?? abonos.error ?? compras.error ?? mermas.error ?? gastos.error;
  if (error) {
    console.error("hoy: no se pudo leer lo último", { codigo: error.code });
    return (
      <section aria-labelledby="lo-ultimo" className="mt-3.5 lg:mt-0">
        <h2 id="lo-ultimo" className="mb-2.5 text-xl font-extrabold">Lo último</h2>
        <Aviso titulo="No pudimos leer tus últimas operaciones" accion={<BotonReintentar />}>
          Revisa tu señal. Lo que ya guardaste está a salvo.
        </Aviso>
      </section>
    );
  }

  const items = (lista: { cantidad: number; producto: PartesProducto | null }[]) =>
    lista.map((i) => ({ cantidad: Number(i.cantidad), producto: i.producto }));

  const operaciones = ultimas(
    [
      ...(ventas.data ?? []).map((v) =>
        deVenta({ id: v.id, fecha: v.fecha, total: Number(v.total), condicion: v.condicion, medio: v.medio_pago as Medio | null, cliente: v.cliente, items: items(v.items) }),
      ),
      ...(abonos.data ?? []).map((a) => deAbono({ id: a.id, fecha: a.fecha, monto: Number(a.monto), medio: a.medio_pago as Medio, cliente: a.cliente, alLlevar: a.venta_id !== null })),
      ...(compras.data ?? []).map((c) => deCompra({ id: c.id, fecha: c.fecha, total: Number(c.total), proveedor: c.proveedor, items: items(c.items) })),
      ...(mermas.data ?? []).map((m) => deMerma({ id: m.id, fecha: m.fecha, cantidad: Number(m.cantidad), motivo: m.motivo, producto: m.producto })),
      ...(gastos.data ?? []).map((g) => deGasto({ id: g.id, fecha: g.fecha, monto: Number(g.monto), categoria: g.categoria, descripcion: g.descripcion })),
    ],
    CUANTAS,
  );

  if (operaciones.length === 0) return null;

  return (
    <section aria-labelledby="lo-ultimo" className="mt-3.5 animate-subir [animation-delay:200ms] lg:mt-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="lo-ultimo" className="text-xl font-extrabold">
          Lo último
        </h2>
        <Link href="/ventas" className="-mr-2 inline-flex min-h-12 items-center gap-0.5 px-2 font-extrabold text-acento-texto">
          Ver todo
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
      <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta" data-testid="lo-ultimo">
        {operaciones.map((op) => (
          <FilaOperacion key={op.clave} op={op} />
        ))}
      </ul>
    </section>
  );
}
