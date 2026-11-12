import Link from "next/link";
import { Truck } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Vacio } from "@/components/ui/Vacio";

// Un enlace roto o un proveedor que no existe: se dice en lenguaje de puesto y se ofrece volver a la lista.
export default function ProveedorNoEncontrado() {
  return (
    <>
      <Encabezado titulo="Proveedor" volver={{ href: "/proveedores", texto: "Proveedores" }} />
      <Vacio
        icono={<Truck />}
        titulo="No encontré a ese proveedor"
        accion={
          <Link href="/proveedores" className="flex min-h-12 items-center justify-center font-extrabold text-acento-texto">
            Ver tus proveedores
          </Link>
        }
      >
        Puede que el enlace esté mal escrito.
      </Vacio>
    </>
  );
}
