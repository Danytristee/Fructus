import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Ventas · Fructus" };

// Marco de A2: la pantalla de verdad llega en A6 y A9.
export default function Ventas() {
  return (
    <>
      <Encabezado titulo="Ventas" />
      <Vacio icono={<Receipt />} titulo="Todas tus ventas">
        Aquí vas a ver cada venta del día y de días anteriores, y sacar su boleta o factura.
      </Vacio>
    </>
  );
}
