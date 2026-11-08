import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { leerInventario } from "@/lib/inventario";
import { exigirSesion } from "@/lib/sesion";

const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;

// El aviso del dashboard de inventario en «Hoy»: lo más urgente, a un toque de Stock. Sin alertas, no ocupa lugar.
export async function AvisoInventario() {
  const { supabase } = await exigirSesion();
  const inventario = await leerInventario(supabase).catch((e: unknown) => {
    console.error("hoy: no se pudo leer el inventario", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  });
  if (!inventario || inventario.alertas.length === 0) return null;
  const { resumen, alertas } = inventario;
  const partes = [
    resumen.frutasPorMalograrse > 0 && plural(resumen.frutasPorMalograrse, "fruta por malograrse", "frutas por malograrse"),
    resumen.porReponer > 0 && plural(resumen.porReponer, "por reponer", "por reponer"),
  ].filter(Boolean);
  const titulo = partes.length ? partes.join(" y ") : plural(alertas.length, "aviso de tu stock", "avisos de tu stock");

  return (
    <Link
      href="/stock"
      className="vidrio mt-2.5 grid animate-subir grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-tarjeta p-4 transition-transform duration-150 [animation-delay:200ms] active:scale-[0.98]"
    >
      <span className="relative grid size-[52px] place-items-center rounded-[18px] bg-deuda-fondo text-deuda">
        <TriangleAlert aria-hidden />
        {/* El anillo que se abre dos veces: un círculo que crece y se desvanece (transform y opacity), no una sombra que se agranda. */}
        <span aria-hidden className="absolute -top-1 -right-1 size-3.5 animate-pulso-alerta rounded-full bg-deuda/45" />
        <span aria-hidden className="absolute -top-1 -right-1 size-3.5 rounded-full bg-deuda ring-2 ring-superficie" />
      </span>
      <span className="grid min-w-0">
        <span className="font-extrabold first-letter:uppercase">{titulo}</span>
        <span className="truncate text-base text-texto-suave">{alertas[0]!.titulo}</span>
        <span className="mt-0.5 font-extrabold text-acento-texto">Ver qué hacer</span>
      </span>
      <ChevronRight aria-hidden className="size-6 text-texto-suave" />
    </Link>
  );
}
