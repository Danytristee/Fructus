import { notFound } from "next/navigation";
import { Wallet, HandCoins } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { FondoAurora } from "@/components/ui/FondoAurora";
import { Fruta, frutasIlustradas } from "@/components/ui/Fruta";
import { Insignia } from "@/components/ui/Insignia";
import { Monto } from "@/components/ui/Monto";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { formatearCajas } from "@/lib/formato";
import { DemoVoz } from "./DemoVoz";
import { TemaEnHtml } from "./TemaEnHtml";

// Catálogo de las piezas de components/ui/ con la identidad Aurora (ADR-0007). Solo en desarrollo.
export default async function Piezas({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const tema = (await searchParams).tema === "oscuro" ? "oscuro" : "claro";

  const colores = ["fondo", "vidrio", "superficie", "texto", "texto-suave", "acento", "exito", "exito-fondo", "deuda", "deuda-fondo"];

  return (
    <div data-theme={tema} className="min-h-dvh px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(200px+env(safe-area-inset-bottom))] text-texto">
      <TemaEnHtml tema={tema} />
      <FondoAurora />
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Piezas</h1>
        <a
          href={tema === "oscuro" ? "/piezas" : "/piezas?tema=oscuro"}
          className="vidrio inline-flex min-h-12 items-center rounded-full px-4 font-extrabold"
        >
          {tema === "oscuro" ? "Ver en claro" : "Ver en oscuro"}
        </a>
      </header>

      <Tarjeta protagonista className="mb-3 grid">
        <span className="font-bold text-texto-suave">Vendiste hoy</span>
        <Monto valor={2480} tamano="total" />
        <span className="text-texto-suave">{formatearCajas(54)} en 23 ventas</span>
      </Tarjeta>

      <div className="mb-6 grid gap-2.5">
        <Tarjeta className="grid grid-cols-[auto_1fr] items-center gap-3.5">
          <span className="grid size-[52px] place-items-center rounded-[18px] bg-exito-fondo text-exito"><Wallet aria-hidden /></span>
          <span className="grid">
            <span className="font-bold text-texto-suave">Cobraste</span>
            <Monto valor={1630} tamano="cifra" tono="exito" />
          </span>
        </Tarjeta>
        <Tarjeta className="grid grid-cols-[auto_1fr] items-center gap-3.5">
          <span className="grid size-[52px] place-items-center rounded-[18px] bg-deuda-fondo text-deuda"><HandCoins aria-hidden /></span>
          <span className="grid">
            <span className="font-bold text-texto-suave">Te deben</span>
            <Monto valor={3215.5} tamano="cifra" tono="deuda" />
          </span>
        </Tarjeta>
      </div>

      <h2 className="mb-2.5 text-xl font-extrabold">Insignias</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        <Insignia tipo="pago">Pagó</Insignia>
        <Insignia tipo="debe">Lo debe</Insignia>
        <Insignia tipo="sugerido">sugerido</Insignia>
        <Insignia tipo="aviso">Quedan pocas</Insignia>
      </div>

      <h2 className="mb-2.5 text-xl font-extrabold">Botones</h2>
      <div className="mb-6 grid gap-2.5">
        <Boton>Confirmar venta</Boton>
        <Boton cargando>Confirmar venta</Boton>
        <Boton variante="secundario">Registrar abono</Boton>
        <Boton variante="texto">Descartar</Boton>
      </div>

      <h2 className="mb-2.5 text-xl font-extrabold">Fruta</h2>
      <Tarjeta className="mb-6 flex justify-around">
        {frutasIlustradas.map((f) => (
          <Fruta key={f} fruta={f} tamano={52} />
        ))}
      </Tarjeta>

      <h2 className="mb-2.5 text-xl font-extrabold">Colores</h2>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {colores.map((c) => (
          <div key={c} className="vidrio flex items-center gap-2.5 rounded-control p-2">
            <span className="size-10 shrink-0 rounded-xl border border-border" style={{ background: `var(--${c})` }} />
            <span className="text-[15px] font-bold">{c}</span>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 flex justify-center">
        <DemoVoz />
      </div>
    </div>
  );
}
