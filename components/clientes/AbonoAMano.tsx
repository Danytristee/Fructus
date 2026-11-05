import { HandCoins } from "lucide-react";

import { BarraFlotante } from "@/components/ui/BarraFlotante";
import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaAbonoAMano } from "@/lib/a-mano-reglas";

type Persona = { id: number; nombre: string };

// «Registrar abono»: flota sobre la ficha y el cuaderno, en el tercio de abajo y sobre la barra, que es donde alcanza el
// pulgar (CLAUDE.md, regla 1). Desde la ficha ya trae al cliente; desde el cuaderno se elige, y se ofrece primero a los que
// más deben.
export function AbonoAMano({ cliente, sugeridos = [] }: { cliente: Persona | null; sugeridos?: Persona[] }) {
  return (
    <BarraFlotante>
      <OperacionAMano
        intencion="registrar_abono"
        tarjeta={tarjetaAbonoAMano(cliente, sugeridos)}
        titulo="Registrar abono"
        icono={<HandCoins aria-hidden />}
        variante="flotante"
      />
    </BarraFlotante>
  );
}
