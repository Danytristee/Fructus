import { HandCoins, TrendingUp, Wallet } from "lucide-react";

import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";
import { MontoVivo } from "@/components/ui/MontoVivo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { Vacio } from "@/components/ui/Vacio";
import { inicioDelDiaLima, leerResumen, textoVentas, ventasPorHora } from "@/lib/hoy-reglas";
import { exigirSesion } from "@/lib/sesion";
import { GraficoDia } from "./GraficoDia";

// El resumen del día: lo vendido como protagonista, lo cobrado y lo que te deben. Lee de resumen_dia() (CLAUDE.md, «Base de datos»).
export async function ResumenDia() {
  const { supabase } = await exigirSesion();
  const ahora = new Date();
  const [resumen, ventas, deudores] = await Promise.all([
    supabase.rpc("resumen_dia"),
    supabase.from("ventas").select("fecha, total").eq("estado", "registrada").gte("fecha", inicioDelDiaLima(ahora)),
    supabase.from("v_saldo_clientes").select("cliente_id", { count: "exact", head: true }).gt("saldo", 0),
  ]);

  const error = resumen.error ?? ventas.error ?? deudores.error;
  if (error) {
    console.error("hoy: no se pudo leer el resumen", { codigo: error.code });
    return (
      <Aviso titulo="No pudimos leer tu día" accion={<BotonReintentar />}>
        Revisa tu señal. Lo que ya guardaste está a salvo.
      </Aviso>
    );
  }

  const dia = leerResumen(resumen.data);
  const horas = ventasPorHora((ventas.data ?? []).map((v) => ({ fecha: v.fecha, total: Number(v.total) })), ahora);
  const clientesQueDeben = deudores.count ?? 0;

  return (
    <div className="grid gap-2.5">
      {dia.numeroVentas === 0 ? (
        <Vacio icono={<TrendingUp />} titulo="Todavía no vendiste hoy" className="animate-subir">
          Mantén el botón de abajo y di la venta, por ejemplo: «10 cajas de mango a don Lucho».
        </Vacio>
      ) : (
        <Tarjeta protagonista className="grid animate-subir" aria-label="Lo vendido hoy">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-texto-suave">Vendiste hoy</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-exito-fondo px-2.5 py-1 text-[15px] font-extrabold text-exito">
              <TrendingUp aria-hidden className="size-4" />
              {dia.numeroVentas} {dia.numeroVentas === 1 ? "venta" : "ventas"}
            </span>
          </div>
          <span data-testid="monto-vendido">
            <MontoVivo valor={dia.vendido} tamano="total" className="my-0.5" />
          </span>
          <span className="text-texto-suave">{textoVentas(dia.numeroVentas, dia.cajas)}</span>
          <GraficoDia horas={horas} />
        </Tarjeta>
      )}

      <Tarjeta className="grid animate-subir grid-cols-[auto_1fr] items-center gap-3.5 [animation-delay:70ms]">
        <span className="grid size-[52px] place-items-center rounded-[18px] bg-exito-fondo text-exito">
          <Wallet aria-hidden />
        </span>
        <span className="grid">
          <span className="font-bold text-texto-suave">Cobraste</span>
          <span data-testid="monto-cobrado">
            <MontoVivo valor={dia.cobrado} tamano="cifra" tono="exito" />
          </span>
        </span>
      </Tarjeta>

      <Tarjeta className="grid animate-subir grid-cols-[auto_1fr] items-center gap-3.5 [animation-delay:140ms]">
        <span className="grid size-[52px] place-items-center rounded-[18px] bg-deuda-fondo text-deuda">
          <HandCoins aria-hidden />
        </span>
        <span className="grid">
          <span className="font-bold text-texto-suave">Te deben</span>
          <span data-testid="monto-deben">
            <MontoVivo valor={dia.porCobrar} tamano="cifra" tono={dia.porCobrar > 0 ? "deuda" : "normal"} />
          </span>
          {clientesQueDeben > 0 && (
            <span className="text-[15px] text-texto-suave">
              entre {clientesQueDeben} {clientesQueDeben === 1 ? "cliente" : "clientes"}
            </span>
          )}
        </span>
      </Tarjeta>
    </div>
  );
}
