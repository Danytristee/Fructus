import type { Metadata } from "next";
import { Package } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Stock · Fructus" };

// Marco de A2: la pantalla de verdad llega en A8.
export default function Stock() {
  return (
    <>
      <Encabezado titulo="Stock" />
      <Vacio icono={<Package />} titulo="Tus cajas, fruta por fruta">
        Aquí vas a ver cuántas cajas te quedan de cada fruta, y registrar compras y mermas.
      </Vacio>
    </>
  );
}
