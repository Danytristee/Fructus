import { MessageCircle } from "lucide-react";

import { BotonEnlace } from "@/components/ui/BotonEnlace";
import { enlaceWhatsAppDelCierre, hayMovimientoEnElCierre, type Cierre } from "@/lib/cierre-reglas";

// Lo que se hace con el cierre al terminar el día: mandarlo. WhatsApp se abre con el mensaje ya escrito y la persona elige a quién
// (es un enlace: no suma JavaScript). Un día en cero no ofrece nada que mandar.
export function EnviarCierre({ c }: { c: Cierre }) {
  if (!hayMovimientoEnElCierre(c)) return null;
  return (
    <div className="animate-subir [animation-delay:440ms]">
      <BotonEnlace href={enlaceWhatsAppDelCierre(c, new Date())} target="_blank" className="w-full">
        <MessageCircle aria-hidden /> Enviar por WhatsApp
      </BotonEnlace>
    </div>
  );
}
