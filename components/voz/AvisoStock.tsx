import { Aviso } from "@/components/ui/Aviso";
import { SUGERENCIA_AVISO, textoAvisos, type AvisoStock as Faltante } from "@/lib/voz/stock-venta-reglas";

// El aviso de stock de la tarjeta de venta: uno solo para todas las frutas, para no empujar el total fuera de la pantalla. Avisa, no
// bloquea.
export function AvisoStock({ avisos, className }: { avisos: Faltante[]; className?: string }) {
  if (avisos.length === 0) return null;
  return (
    <Aviso tipo="atencion" titulo={textoAvisos(avisos)} className={className}>
      {SUGERENCIA_AVISO}
    </Aviso>
  );
}
