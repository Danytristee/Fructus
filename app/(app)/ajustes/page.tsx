import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ajustes · Fructus" };

// Marco de A2: la pantalla de verdad llega en A12.
export default async function Ajustes() {
  // La guarda va en el servidor: esconder el enlace del menú no basta, alguien puede escribir /ajustes.
  const { permisos } = await exigirSesion();
  if (!permisos.ajustes) {
    return (
      <>
        <Encabezado titulo="Ajustes" />
        <Aviso titulo="Ajustes es solo para el dueño o el administrador">
          Si necesitas cambiar un precio o una fruta, pídeselo al dueño.
        </Aviso>
      </>
    );
  }
  return (
    <>
      <Encabezado titulo="Ajustes" />
      <Vacio icono={<Settings />} titulo="Tu catálogo y tu equipo">
        Aquí vas a cambiar tus frutas y precios, y dar acceso a tus ayudantes.
      </Vacio>
    </>
  );
}
