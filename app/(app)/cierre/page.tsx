import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Cierre del día · Fructus" };

// Marco de A2: la pantalla de verdad llega en A10.
export default function Cierre() {
  return (
    <>
      <Encabezado titulo="Cierre del día" />
      <Vacio icono={<ClipboardCheck />} titulo="El resumen para cerrar caja">
        Aquí vas a ver lo vendido al contado y al crédito, lo cobrado, los gastos y el efectivo que debe haber en caja.
      </Vacio>
    </>
  );
}
