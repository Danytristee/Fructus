import Link from "next/link";
import { Users } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

// Un enlace roto o un cliente que no existe: se dice en lenguaje de puesto y se ofrece volver al cuaderno.
export default function ClienteNoEncontrado() {
  return (
    <>
      <Encabezado titulo="Cliente" volver={{ href: "/clientes", texto: "Clientes" }} />
      <Vacio
        icono={<Users />}
        titulo="No encontré a ese cliente"
        accion={
          <Link href="/clientes" className="flex min-h-12 items-center justify-center font-extrabold text-acento-texto">
            Ver el cuaderno
          </Link>
        }
      >
        Puede que el enlace esté mal escrito.
      </Vacio>
    </>
  );
}
