import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Cierre del día · Fructus" };

// Marco de A2: la pantalla de verdad llega en A10.
export default async function Cierre() {
  const { permisos } = await exigirSesion();
  if (!permisos.cierre) {
    return (
      <>
        <Encabezado titulo="Cierre del día" />
        <Aviso titulo="No tienes acceso al cierre del día">Pídele al dueño que revise tu cuenta.</Aviso>
      </>
    );
  }
  return (
    <>
      <Encabezado titulo="Cierre del día" />
      <Vacio icono={<ClipboardCheck />} titulo="El resumen para cerrar caja">
        Aquí vas a ver lo vendido al contado y al crédito, lo cobrado, los gastos y el efectivo que debe haber en caja.
      </Vacio>
    </>
  );
}
