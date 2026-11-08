import { PantallaEsqueleto } from "@/components/ui/Esqueleto";

// El esqueleto del cuaderno: se ve al instante al tocar «Clientes», antes de que el servidor conteste. Next precarga el `loading.tsx` del segmento
// al que se va.
// Vive en el grupo `(lista)` a propósito, y no en `clientes/`: allí envolvería también la ficha (`[id]`), y una ficha que no existe respondería 200
// en vez de 404 (la respuesta ya salió con el esqueleto cuando `notFound()` se llama). Un enlace roto tiene que decir 404.
export default function Cargando() {
  return <PantallaEsqueleto />;
}
