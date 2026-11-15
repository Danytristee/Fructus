import Link from "next/link";
import { ChevronRight, HandCoins, TrendingUp, Wallet } from "lucide-react";

import { VentasPorEnviar } from "@/components/cola/VentasPorEnviar";
import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { Vacio } from "@/components/ui/Vacio";
import { diaDeLima, formatearSoles } from "@/lib/formato";
import { inicioDelDiaLima, leerResumen, textoVentas, ventasPorHora } from "@/lib/hoy-reglas";
import { leerInventario } from "@/lib/inventario";
import { exigirSesion } from "@/lib/sesion";
import { leerTemperaturas } from "@/lib/temperatura";
import { AvisosDeHoy } from "./AvisosDeHoy";
import { GraficoDia } from "./GraficoDia";

const sinLeer = (que: string) => (e: unknown) => {
  console.error(`hoy: no se pudo leer ${que}`, { error: e instanceof Error ? e.message : "desconocido" });
  return null;
};

// El resumen del día: lo vendido como protagonista, lo que el puesto pide hoy (fruta que tiene que salir, la temperatura) y lo
// cobrado y lo que te deben. Lee de resumen_dia() (CLAUDE.md, «Base de datos»). Todo se lee a la vez y aparece junto: si los avisos
// llegaran después, empujarían «Te deben» justo cuando se lo va a tocar. Si el inventario o la temperatura no se pueden leer,
// el día igual sale, sin ese renglón (principio 8).
// Son tres piezas sueltas de la grilla de «Hoy» (app/(app)/(hoy)/page.tsx): en celular van una debajo de la otra, en este orden;
// en escritorio (ADR-0015), lo vendido a la izquierda, lo cobrado al lado y los avisos debajo, junto a «Lo último».
export async function ResumenDia({ pideTemperatura }: { pideTemperatura: boolean }) {
  const { supabase } = await exigirSesion();
  const ahora = new Date();
  const [resumen, ventas, deudores, inventario, lecturas] = await Promise.all([
    supabase.rpc("resumen_dia"),
    supabase.from("ventas").select("fecha, total").eq("estado", "registrada").gte("fecha", inicioDelDiaLima(ahora)),
    supabase.from("v_saldo_clientes").select("cliente_id", { count: "exact", head: true }).gt("saldo", 0),
    leerInventario(supabase, ahora).catch(sinLeer("el inventario")),
    // Solo se le pide a quien puede anotarla: el contador no la ve pedir.
    pideTemperatura ? leerTemperaturas(supabase, ahora).catch(sinLeer("la temperatura")) : null,
  ]);

  const error = resumen.error ?? ventas.error ?? deudores.error;
  if (error) {
    console.error("hoy: no se pudo leer el resumen", { codigo: error.code });
    return (
      <Aviso titulo="No pudimos leer tu día" accion={<BotonReintentar />} className="lg:col-span-12">
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }

  const dia = leerResumen(resumen.data);
  const horas = ventasPorHora((ventas.data ?? []).map((v) => ({ fecha: v.fecha, total: Number(v.total) })), ahora);
  const clientesQueDeben = deudores.count ?? 0;

  return (
    <>
      {dia.numeroVentas === 0 ? (
        <Vacio icono={<TrendingUp />} titulo="Todavía no vendiste hoy" className="animate-subir lg:col-span-7 lg:col-start-1 lg:row-start-1">
          Toca el botón de abajo y di la venta, por ejemplo: «10 cajas de mango a don Lucho».
          <VentasPorEnviar />
        </Vacio>
      ) : (
        <Tarjeta protagonista className="grid animate-subir lg:col-span-7 lg:col-start-1 lg:row-start-1" aria-label="Lo vendido hoy">
          <span className="font-bold text-texto-suave">Vendiste hoy</span>
          <span data-testid="monto-vendido">
            <MontoVivo valor={dia.vendido} tamano="total" className="my-0.5" />
          </span>
          {/* El veredicto que hace cuadrar las cuentas: lo vendido es contado más crédito. */}
          <span data-testid="desglose-vendido" className="text-texto-suave">
            <strong className="cifra font-extrabold text-texto">{formatearSoles(dia.contado)}</strong> al contado y{" "}
            <strong className="cifra font-extrabold text-texto">{formatearSoles(dia.credito)}</strong> al crédito
          </span>
          <span className="text-texto-suave">{textoVentas(dia.numeroVentas, dia.cajas)}</span>
          {/* Lo confirmado sin señal todavía no está en la base: se dice aparte (ADR-0019). */}
          <VentasPorEnviar />
          <GraficoDia horas={horas} />
        </Tarjeta>
      )}

      {/* En escritorio baja a la segunda fila, a la altura de la lista de «Lo último» (su título mide 60 px). */}
      <AvisosDeHoy inventario={inventario} lecturas={lecturas} hoy={diaDeLima(ahora)} className="lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:mt-[60px]" />

      {/* Lo que entró y lo que falta entrar, juntos en una tarjeta: se leen como un par. El ícono va chico junto a la etiqueta para que la
          cifra use todo el ancho: a 360 px, un monto de cinco cifras al lado de un ícono grande no entraba (ADR-0014). */}
      <Tarjeta className="grid animate-subir overflow-hidden p-0 [animation-delay:70ms] lg:col-span-5 lg:col-start-8 lg:row-start-1" aria-label="Lo que cobraste y lo que te deben">
        <div className="grid gap-0.5 p-4">
          <span className="flex items-center gap-2 font-bold text-texto-suave">
            <span className="grid size-8 place-items-center rounded-[11px] bg-exito-fondo text-exito">
              <Wallet aria-hidden className="size-[18px]" />
            </span>
            Cobraste
          </span>
          <span data-testid="monto-cobrado">
            <MontoVivo valor={dia.cobrado} tamano="cifra" tono="exito" />
          </span>
          {/* Los dos números, para que nadie tenga que restar (segunda prueba ciega de /formidable). */}
          <span data-testid="desglose-cobrado" className="text-texto-suave">
            <strong className="cifra font-extrabold text-texto">{formatearSoles(dia.contado)}</strong> de ventas al contado
            {dia.abonos > 0 && (
              <>
                {" "}
                y <strong className="cifra font-extrabold text-texto">{formatearSoles(dia.abonos)}</strong> de abonos
              </>
            )}
          </span>
        </div>
        <hr className="mx-4 border-border" />
        {/* Lo difícil, a un toque: quién te debe y cuánto vive en Clientes (/formidable 2026-10-28). */}
        <Link
          href="/clientes"
          className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 transition-colors duration-150 ease-out active:bg-acento/6"
        >
          <span className="grid gap-0.5">
            <span className="flex items-center gap-2 font-bold text-texto-suave">
              <span className="grid size-8 place-items-center rounded-[11px] bg-deuda-fondo text-deuda">
                <HandCoins aria-hidden className="size-[18px]" />
              </span>
              Te deben
            </span>
            <span data-testid="monto-deben">
              <MontoVivo valor={dia.porCobrar} tamano="cifra" tono={dia.porCobrar > 0 ? "deuda" : "normal"} />
            </span>
            <span className="text-texto-suave">
              {clientesQueDeben === 0
                ? "Nadie te debe"
                : `Todo tu cuaderno: ${clientesQueDeben} ${clientesQueDeben === 1 ? "cliente" : "clientes"}`}
            </span>
            <span className="mt-1 font-extrabold text-acento-texto">Ver quién te debe</span>
          </span>
          <ChevronRight aria-hidden className="size-6 text-texto-suave" />
        </Link>
      </Tarjeta>
    </>
  );
}
