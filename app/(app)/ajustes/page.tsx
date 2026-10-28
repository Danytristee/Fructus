import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Ajustes · Fructus" };

// Marco de A2: la pantalla de verdad llega en A12.
export default function Ajustes() {
  return (
    <>
      <Encabezado titulo="Ajustes" />
      <Vacio icono={<Settings />} titulo="Tu catálogo y tu equipo">
        Aquí vas a cambiar tus frutas y precios, y dar acceso a tus ayudantes.
      </Vacio>
    </>
  );
}
