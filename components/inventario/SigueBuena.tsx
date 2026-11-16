"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { anotarSigueBuena } from "@/app/(app)/acciones-frescura";
import { useCola } from "@/components/cola/ColaProveedor";
import { Boton } from "@/components/ui/Boton";
import { useEspera } from "@/components/ui/Espera";
import { sonarGuardado, vibrar } from "@/components/voz/senales";
import { SIN_SENAL } from "@/lib/cola-reglas";
import type { LoteEstimado } from "@/lib/inventario-reglas";

/** Si la señal no contesta en este tiempo, se dice y se deja intentar otra vez: anotar dos veces no duplica. */
const TOPE_MS = 15_000;
const NECESITA_SENAL = "Sin señal: para anotar esto necesitas señal.";

type Props = { productoId: number; lote: Pick<LoteEstimado, "dia" | "estado" | "antes">; alError: (error: string | null) => void };

// «Sigue buena»: un toque para decir que la llegada que ya pasó su día se miró y sigue vendible (ADR-0021). No lleva tarjeta de
// confirmación: no mueve dinero ni stock, y el toque es la confirmación. Nada optimista: la hoja cambia a «Sigue buena» recién
// cuando la base respondió, con vibración y sonido. No se encola sin señal (regla 10): lo dice y espera.
export function SigueBuena({ productoId, lote, alError }: Props) {
  const router = useRouter();
  const esperar = useEspera();
  const sinSenal = useCola()?.situacion.enLinea === false;
  const [guardando, setGuardando] = useState(false);
  // El estado no alcanza para frenar cinco toques del mismo instante (todavía no se volvió a dibujar): la base no duplicaba,
  // pero salían cinco pedidos (/chaos 2026-11-16).
  const enCurso = useRef(false);

  async function anotar() {
    if (enCurso.current) return;
    if (sinSenal || !navigator.onLine) return alError(NECESITA_SENAL);
    enCurso.current = true;
    setGuardando(true);
    alError(null);
    let reloj = 0;
    const tope = new Promise<{ ok: false; error: string }>((resolve) => {
      reloj = window.setTimeout(() => resolve({ ok: false, error: SIN_SENAL }), TOPE_MS);
    });
    const pedido = anotarSigueBuena({ productoId, llegadaDia: lote.antes ? null : lote.dia, estado: lote.estado }).catch(() => ({ ok: false as const, error: SIN_SENAL }));
    const r = await esperar(Promise.race([pedido, tope]), "Anotando…");
    window.clearTimeout(reloj);
    enCurso.current = false;
    setGuardando(false);
    if (!r.ok) return alError(r.error);
    vibrar(30);
    sonarGuardado();
    router.refresh();
  }

  return (
    <Boton variante="secundario" onClick={() => void anotar()} cargando={guardando} className="w-full">
      <Check aria-hidden />
      Sigue buena
    </Boton>
  );
}
