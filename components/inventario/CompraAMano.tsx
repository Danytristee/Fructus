import { Truck } from "lucide-react";

import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaCompraAMano } from "@/lib/a-mano-reglas";

type Persona = { id: number; nombre: string };

// «Compra» en la barra flotante de Stock: proveedor (o el mercado), frutas, cajas y costo, y si se pagó o se debe (nunca se
// asume contado). Se ofrece primero a los proveedores y a las frutas que más conviene reponer. `temperatura` es la que se
// cuenta hoy: con ella la tarjeta dice cuánto va a aguantar lo que llegó.
export function CompraAMano({ proveedores, frutas, temperatura }: { proveedores: Persona[]; frutas: Persona[]; temperatura: number | null }) {
  return (
    <OperacionAMano
      intencion="registrar_compra"
      tarjeta={tarjetaCompraAMano(proveedores, frutas, temperatura)}
      titulo="Registrar compra"
      etiqueta="Compra"
      icono={<Truck aria-hidden />}
      variante="flotante"
    />
  );
}
