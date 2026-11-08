import { PantallaEsqueleto } from "@/components/ui/Esqueleto";

// El esqueleto de esta pantalla: se ve al instante al tocar su enlace, antes de que el servidor conteste. Next precarga el `loading.tsx` del
// segmento al que se va.
export default function Cargando() {
  return <PantallaEsqueleto />;
}
