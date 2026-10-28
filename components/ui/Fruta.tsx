import Image from "next/image";
import { cn } from "cn";

// Ilustraciones propias en public/frutas/. Las que faltan se dibujan cuando entre su producto al catálogo.
export const frutasIlustradas = ["mango", "platano", "pina", "naranja"] as const;
type FrutaIlustrada = (typeof frutasIlustradas)[number];

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
      className={cn("sombra-fruta", className)}
    />
  );
}
