import { Mic, Volume2 } from "lucide-react";

import type { Fase } from "@/lib/voz/manos-libres-reglas";

/**
 * La línea de manos libres sobre Confirmar (ADR-0020), igual en todas las tarjetas: un micrófono mientras escucha y un parlante
 * mientras lee o explica, con lo que dice `useManosLibres`. null si no hay nada que decir: el pie no deja una línea vacía.
 */
export function notaDeVoz({ fase, nota }: { fase: Fase; nota: string | null }): React.ReactNode {
  if (!nota) return null;
  const Icono = fase === "escuchando" ? Mic : Volume2;
  return (
    <>
      <Icono aria-hidden className="mt-0.5 size-5 shrink-0 text-acento-texto" />
      {nota}
    </>
  );
}
