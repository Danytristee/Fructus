import { PantallaEsqueleto } from "@/components/ui/Esqueleto";

// El esqueleto de «Hoy»: se ve al instante al tocar «Hoy», antes de que el servidor conteste. Cada pantalla de la barra de abajo tiene el suyo: Next
// precarga el `loading.tsx` del segmento al que se va, y el de una carpeta de arriba no alcanza para tocar un enlace hermano.
// Vive en el grupo `(hoy)` a propósito, y no en `(app)/`: allí envolvería TODAS las pantallas, también la ficha de un cliente, y una ficha que no
// existe respondería 200 en vez de 404 (la respuesta ya salió con el esqueleto cuando `notFound()` se llama). Un enlace roto tiene que decir 404.
export default function Cargando() {
  return <PantallaEsqueleto />;
}
