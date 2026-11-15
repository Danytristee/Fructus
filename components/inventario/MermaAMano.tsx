import { TriangleAlert } from "lucide-react";

import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaMermaAMano } from "@/lib/a-mano-reglas";

type Persona = { id: number; nombre: string };

// «Merma» en la barra flotante de Stock (se elige la fruta, y se ofrece primero la que más se gasta) o «Se malogró» en la fila
// de una fruta, que ya trae la fruta y solo falta decir cuántas cajas.
type Props = { producto: Persona | null; sugeridos?: Persona[]; variante: "flotante" | "fila"; alGuardar?: () => void };

export function MermaAMano({ producto, sugeridos = [], variante, alGuardar }: Props) {
  return (
    <OperacionAMano
      intencion="registrar_merma"
      tarjeta={tarjetaMermaAMano(producto, sugeridos)}
      titulo="Registrar merma"
      etiqueta={variante === "fila" ? "Se malogró" : "Merma"}
      icono={<TriangleAlert aria-hidden />}
      variante={variante}
      alGuardar={alGuardar}
    />
  );
}
