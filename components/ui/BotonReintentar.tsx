"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

import { Boton } from "./Boton";

// Vuelve a pedirle los datos al servidor sin recargar la página. Para los avisos de «no pudimos leer…».
export function BotonReintentar({ className }: { className?: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <Boton variante="secundario" cargando={pendiente} className={className} onClick={() => iniciar(() => router.refresh())}>
      <RotateCw aria-hidden />
      Volver a intentar
    </Boton>
  );
}
