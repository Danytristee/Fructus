import { ListChecks } from "lucide-react";

import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaConteoAMano } from "@/lib/a-mano-reglas";

type Persona = { id: number; nombre: string };

// «Contar» (ADR-0027): en la fila de una fruta, que ya la trae, o al final de la lista de Stock para las que no tienen cajas según la app
// (no tienen fila, y contarlas es justo el caso de «llegó sin anotar»). No va en la barra flotante: con tres píldoras, a 360 px se partía
// en dos renglones y tapaba la lista.
type Props = { producto: Persona | null; sugeridos?: Persona[]; variante: "flotante" | "fila"; etiqueta?: string };

export function ConteoAMano({ producto, sugeridos = [], variante, etiqueta = "Contar" }: Props) {
  return (
    <OperacionAMano
      intencion="registrar_conteo"
      tarjeta={tarjetaConteoAMano(producto, sugeridos)}
      titulo="Contar cajas"
      etiqueta={etiqueta}
      icono={<ListChecks aria-hidden />}
      variante={variante}
    />
  );
}
