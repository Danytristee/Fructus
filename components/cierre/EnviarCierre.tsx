import { MessageCircle } from "lucide-react";

import { BarraFlotante } from "@/components/ui/BarraFlotante";
import { BotonEnlace } from "@/components/ui/BotonEnlace";
import { enlaceWhatsAppDelCierre, hayMovimientoEnElCierre, type Cierre } from "@/lib/cierre-reglas";

// Lo que se hace con el cierre al terminar el día: mandarlo. WhatsApp se abre con el mensaje ya escrito y la persona elige a quién
// (es un enlace: no suma JavaScript). Un día en cero no ofrece nada que mandar. Flota abajo, sobre la barra, como «Registrar abono» en
// Clientes: al final de la pantalla quedaba a una pantalla y media de distancia y en la prueba a ciegas nadie lo encontró (/formidable
// 2026-11-09).
export function EnviarCierre({ c }: { c: Cierre }) {
  if (!hayMovimientoEnElCierre(c)) return null;
  return (
    <BarraFlotante>
      <BotonEnlace href={enlaceWhatsAppDelCierre(c, new Date())} target="_blank" variante="flotante" className="pointer-events-auto">
        <MessageCircle aria-hidden /> Enviar por WhatsApp
      </BotonEnlace>
    </BarraFlotante>
  );
}
