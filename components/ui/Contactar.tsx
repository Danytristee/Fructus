import { MessageCircle, Phone } from "lucide-react";

import { enlaceDeLlamada, enlaceWhatsApp } from "@/lib/contacto-reglas";

type Props = {
  telefono: string | null;
  /** Lo que se le escribe al abrir WhatsApp: la persona lo lee, lo cambia si quiere y lo manda ella. */
  mensaje: string;
};

// Hablarle a alguien con un toque, como desde la agenda del celular: «WhatsApp» abre el chat con el mensaje ya escrito y «Llamar» marca.
// La misma pieza en la ficha del cliente (para cobrar) y en la del proveedor (para preguntar precios). Si el número no sirve para algo
// (un fijo no tiene WhatsApp), ese botón no sale; sin número, no sale nada.
export function Contactar({ telefono, mensaje }: Props) {
  const llamar = enlaceDeLlamada(telefono);
  const whatsapp = enlaceWhatsApp(telefono, mensaje);
  if (!llamar && !whatsapp) return null;
  return (
    <div className="mb-2.5 grid grid-cols-2 gap-2">
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center gap-2 rounded-control bg-exito-fondo font-extrabold text-exito transition-transform duration-150 active:scale-[0.98]"
        >
          <MessageCircle aria-hidden className="size-5" />
          WhatsApp
        </a>
      )}
      {llamar && (
        <a
          href={llamar}
          className="flex min-h-14 items-center justify-center gap-2 rounded-control bg-acento/12 font-extrabold text-acento-texto transition-transform duration-150 active:scale-[0.98]"
        >
          <Phone aria-hidden className="size-5" />
          Llamar
        </a>
      )}
    </div>
  );
}
