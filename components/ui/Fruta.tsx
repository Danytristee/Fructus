import Image from "next/image";
import { cn } from "cn";

import type { FrutaIlustrada } from "@/lib/frutas";

// Ilustraciones propias en public/frutas/. La lista vive en lib/frutas.ts.

type Props = { fruta: FrutaIlustrada; tamano?: number; className?: string };

/** Decorativa: el nombre de la fruta siempre va escrito al lado. */
export function Fruta({ fruta, tamano = 40, className }: Props) {
  return (
    <Image
      src={`/frutas/${fruta}.svg`}
      alt=""
      width={tamano}
      height={tamano}
      unoptimized
      // Pesan menos de 1 KB: cargarlas «cuando se acerquen» no ahorra nada y las hace aparecer de golpe al deslizar.
      loading="eager"
      className={cn("sombra-fruta", className)}
    />
  );
}
