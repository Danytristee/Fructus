"use client";

import { Boton } from "@/components/ui/Boton";
import { useEspera } from "@/components/ui/Espera";

// Solo para /piezas: simula un guardado que tarda 1.2 s.
export function DemoEspera() {
  const esperar = useEspera();
  return (
    <Boton variante="secundario" onClick={() => esperar(new Promise((listo) => setTimeout(listo, 1200)))}>
      Probar «Guardando…»
    </Boton>
  );
}
