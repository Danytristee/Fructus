import { Thermometer } from "lucide-react";

import { OperacionAMano } from "@/components/voz/OperacionAMano";
import { tarjetaTemperaturaAMano } from "@/lib/a-mano-reglas";

// Anotar a mano lo que marca el termómetro: la misma tarjeta que la voz («hoy hizo 29 grados»), abierta con un toque.
// `hoy` es la que ya se anotó hoy (se está corrigiendo) y `ayer`, la del día anterior: la tarjeta parte de ahí.
// Con `detalle` es un renglón de aviso (el de «Hoy»); sin él, un botón dentro de «El clima del puesto».
export function TemperaturaAMano({ hoy, ayer, etiqueta, detalle }: { hoy: number | null; ayer: number | null; etiqueta: string; detalle?: string }) {
  return (
    <OperacionAMano
      intencion="registrar_temperatura"
      tarjeta={tarjetaTemperaturaAMano(hoy, ayer)}
      titulo="Anotar la temperatura"
      icono={<Thermometer aria-hidden />}
      etiqueta={etiqueta}
      detalle={detalle}
      variante={detalle ? "renglon" : "fila"}
    />
  );
}
