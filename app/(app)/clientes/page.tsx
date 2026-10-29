import type { Metadata } from "next";
import { Suspense } from "react";
import { HandCoins } from "lucide-react";

import { ListaClientes, type ClienteCuaderno } from "@/components/clientes/ListaClientes";
import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { formatearHace } from "@/lib/formato";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Clientes · Fructus" };

// El cuaderno de clientes: cuánto te deben en total, quién más, y el detalle de cada uno (v_saldo_clientes).
async function Cuaderno() {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.from("v_saldo_clientes").select("cliente_id, nombre, alias, saldo, ultima_venta_credito, ultimo_abono");
  if (error) {
    console.error("clientes: no se pudo leer el cuaderno", { codigo: error.code });
    return (
      <Aviso titulo="No pudimos leer tu cuaderno" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  const ahora = new Date();
  const clientes: ClienteCuaderno[] = (data ?? [])
    .map((c) => ({
      id: c.cliente_id ?? 0,
      nombre: c.nombre ?? "",
      apodo: c.alias?.[0] ?? null,
      iniciales: iniciales(c.nombre ?? "?"),
      tono: tonoDe(c.cliente_id ?? 0),
      saldo: Number(c.saldo ?? 0),
      ultimaVenta: c.ultima_venta_credito ? formatearHace(new Date(c.ultima_venta_credito), ahora) : null,
      ultimoAbono: c.ultimo_abono ? formatearHace(new Date(c.ultimo_abono), ahora) : null,
    }))
    .sort((a, b) => b.saldo - a.saldo);
  const total = clientes.reduce((s, c) => s + Math.max(0, c.saldo), 0);
  const deben = clientes.filter((c) => c.saldo > 0);

  return (
    <>
      <Tarjeta protagonista className="grid animate-subir gap-1">
        <span className="flex items-center gap-2.5 font-bold text-texto-suave">
          <span className="grid size-10 place-items-center rounded-2xl bg-deuda-fondo text-deuda">
            <HandCoins aria-hidden className="size-5" />
          </span>
          Te deben en total
        </span>
        <MontoVivo valor={total} tamano="total" tono={total > 0 ? "deuda" : "normal"} />
        <span className="text-texto-suave">
          {deben.length === 0 ? "Nadie te debe" : `entre ${deben.length} ${deben.length === 1 ? "cliente" : "clientes"}; más que nadie, ${deben[0]!.nombre}`}
        </span>
      </Tarjeta>
      <ListaClientes clientes={clientes} totalDeuda={total} />
    </>
  );
}

export default function Clientes() {
  return (
    <>
      <Encabezado titulo="Clientes" subtitulo="Tu cuaderno: quién te debe y cuánto" />
      <Suspense
        fallback={
          <div className="grid gap-2.5" role="status" aria-label="Cargando tu cuaderno">
            <Esqueleto className="h-[150px] rounded-protagonista" />
            <Esqueleto className="h-14 rounded-full" />
            <Esqueleto className="h-[360px]" />
          </div>
        }
      >
        <Cuaderno />
      </Suspense>
    </>
  );
}
