import { Info } from "lucide-react";

// Las dudas del intérprete, como una línea discreta junto a lo que se entendió: abajo quedaban tapadas por Confirmar
// (/formidable 2026-10-29).
export function DudasVoz({ dudas }: { dudas: string[] }) {
  return dudas.map((duda) => (
    <p key={duda} className="mx-1 flex items-start gap-2 text-texto-suave">
      <Info aria-hidden className="mt-1 size-[18px] shrink-0" />
      {duda}
    </p>
  ));
}
