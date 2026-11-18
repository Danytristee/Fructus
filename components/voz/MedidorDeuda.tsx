import { cn } from "cn";

import { estadoDeuda } from "@/lib/ficha-cliente-reglas";
import { formatearSoles } from "@/lib/formato";
import { cuentaAntes, tramosBarra } from "@/lib/voz/medidor-deuda-reglas";

type Props = { saldo: number; total: number; alCredito: boolean };

// Cómo queda la deuda del cliente con esta venta, antes de confirmar (ley 3: un veredicto, no una cuenta). El veredicto es el de la
// ficha del cliente, debe, al día o a favor (lib/voz/medidor-deuda-reglas.ts): un saldo a favor decía «No debía nada» (/chaos
// 2026-11-18).
// Con «Pagó», la venta no suma: basta una línea con lo que ya tenía, y nada si estaba al día (/formidable 2026-10-29). Dice «Te sigue
// debiendo»: «De antes te debe» no decía si esa deuda seguía igual con esta venta (prueba ciega, /formidable 2026-11-18).
// En dos renglones y sin el nombre, que está en la fila del cliente: con cinco, a 360 px la deuda quedaba debajo del pie y había que
// deslizar para leerla (/formidable 2026-11-18).
export function MedidorDeuda({ saldo, total, alCredito }: Props) {
  if (!alCredito) {
    const antes = estadoDeuda(saldo);
    if (antes.tipo === "al_dia") return null;
    return (
      <p className="mx-1 text-lg">
        {antes.tipo === "debe" ? "Te sigue debiendo " : "Tiene "}
        <strong className={cn("cifra", antes.tipo === "debe" ? "text-deuda" : "text-exito")}>{formatearSoles(antes.monto)}</strong>
        {antes.tipo === "a_favor" && " a favor"}
      </p>
    );
  }
  const despues = estadoDeuda(saldo + total);
  const barra = tramosBarra(saldo, total);
  return (
    <div className="rounded-[20px] bg-superficie px-3.5 py-2.5">
      {/* A 360 px caben 300 px: medido con Manrope, cada renglón entra en uno hasta S/ 9,999.99 de deuda (y el de abajo, con cinco
          cifras). Con más, la cifra baja sola a la derecha. «Ya debía» partía el de abajo con ventas de cuatro cifras. Sin «hoy» después
          de la venta: se leía como todo lo fiado hoy, y arriba ya dice «Con esta venta» (prueba ciega). */}
      <p className="flex flex-wrap items-baseline justify-between gap-x-2">
        {despues.tipo === "debe" ? "Con esta venta te debe" : despues.tipo === "a_favor" ? "Le queda a favor" : "Con esta venta queda al día"}
        {despues.tipo !== "al_dia" && (
          <strong className={cn("cifra ml-auto text-lg", despues.tipo === "debe" ? "text-deuda" : "text-exito")}>{formatearSoles(despues.monto)}</strong>
        )}
      </p>
      {/* Sin deuda después de esta venta, no hay barra: no hay qué partir. */}
      {barra && (
        <div aria-hidden className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-texto/8">
          <span className="h-full bg-deuda/55 transition-[width] duration-700 ease-salida" style={{ width: `${barra.antes}%` }} />
          <span className="h-full bg-deuda transition-[width] duration-700 ease-salida" style={{ width: `${barra.hoy}%` }} />
        </div>
      )}
      <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-texto-suave">
        <span>{cuentaAntes(saldo)}</span>
        <span className="ml-auto">+ {formatearSoles(total)}</span>
      </div>
    </div>
  );
}
