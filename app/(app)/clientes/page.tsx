import type { Metadata } from "next";
import { Users } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Clientes · Fructus" };

// Marco de A2: la pantalla de verdad llega en A7.
export default function Clientes() {
  return (
    <>
      <Encabezado titulo="Clientes" />
      <Vacio icono={<Users />} titulo="Tu cuaderno de clientes">
        Aquí vas a ver quién te debe, cuánto y desde cuándo, y registrar sus abonos.
      </Vacio>
    </>
  );
}
