import { Truck } from "lucide-react";

import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaCompraAMano } from "@/lib/a-mano-reglas";

type Persona = { id: number; nombre: string };

// «Compra» en la barra flotante de Stock: proveedor (o el mercado), frutas, cajas y costo, y si se pagó o se debe (nunca se
// asume contado). Se ofrece primero a los proveedores y a las frutas que más conviene reponer.
export function CompraAMano({ proveedores, frutas }: { proveedores: Persona[]; frutas: Persona[] }) {
  return (
    <OperacionAMano
      intencion="registrar_compra"
      tarjeta={tarjetaCompraAMano(proveedores, frutas)}
      titulo="Registrar compra"
      etiqueta="Compra"
      icono={<Truck aria-hidden />}
      variante="flotante"
    />
  );
}
