import type { Metadata } from "next";
import { Suspense } from "react";
import { HandCoins } from "lucide-react";

import { AbonoAMano } from "@/components/clientes/AbonoAMano";
import { BotonCliente } from "@/components/clientes/BotonCliente";
import { ListaClientes, type ClienteCuaderno } from "@/components/clientes/ListaClientes";
import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { Esqueleto } from "@/components/ui/Esqueleto";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { sugeridosParaAbono } from "@/lib/a-mano-reglas";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Clientes · Fructus" };

// El cuaderno de clientes: cuánto te deben en total, quién más, y el detalle de cada uno (v_saldo_clientes).
async function Cuaderno() {
  const { supabase, permisos } = await exigirSesion();
  // Sin saber el rol no se decide qué botones hay: si la base no respondió, se dice que no hubo conexión (lib/sesion.ts: «sin-conexion»).
  if (!permisos) return <SesionSinConexion />;
  const [{ data, error }, datos] = await Promise.all([
    supabase.from("v_saldo_clientes").select("cliente_id, nombre, alias, saldo"),
    // Documento y teléfono, para la tabla de escritorio. Si no responde, la tabla sale sin esas columnas llenas: no se cae el cuaderno.
    supabase.from("clientes").select("id, tipo_documento, numero_documento, telefono"),
  ]);
  if (datos.error) console.error("clientes: no se pudieron leer documentos y teléfonos", { codigo: datos.error.code });
  const porId = new Map((datos.data ?? []).map((c) => [c.id, c]));
  if (error) {
    console.error("clientes: no se pudo leer el cuaderno", { codigo: error.code });
    return (
      <Aviso titulo="No pudimos leer tu cuaderno" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }
  const clientes: ClienteCuaderno[] = (data ?? [])
    .map((c) => ({
      id: c.cliente_id ?? 0,
      nombre: c.nombre ?? "",
      apodo: c.alias?.[0] ?? null,
      iniciales: iniciales(c.nombre ?? "?"),
      tono: tonoDe(c.cliente_id ?? 0),
      saldo: Number(c.saldo ?? 0),
      documento: ((d) => (d?.numero_documento ? [d.tipo_documento, d.numero_documento].filter(Boolean).join(" ") : null))(porId.get(c.cliente_id ?? 0)),
      telefono: porId.get(c.cliente_id ?? 0)?.telefono ?? null,
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
        {/* wrap-anywhere: un nombre largo sin espacios se parte en vez de ensanchar la pantalla (/chaos 2026-11-09). */}
        <span className="text-texto-suave wrap-anywhere">
          {deben.length === 0 ? "Nadie te debe" : `entre ${deben.length} ${deben.length === 1 ? "cliente" : "clientes"}; más que nadie, ${deben[0]!.nombre}`}
        </span>
      </Tarjeta>
      <ListaClientes clientes={clientes} nuevo={permisos.ajustes ? <BotonCliente cliente={null} /> : null} />
      {permisos.registrar && <AbonoAMano cliente={null} sugeridos={sugeridosParaAbono(clientes)} />}
    </>
  );
}

export default function Clientes() {
  return (
    <>
      <Encabezado titulo="Clientes" subtitulo="Tu cuaderno: quién te debe y cuánto" sobreTarjeta />
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
