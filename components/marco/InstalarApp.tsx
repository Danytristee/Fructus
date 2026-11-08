"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { cn } from "cn";

import { estaInstalada, pedirInstalacion, puedePedirInstalacion, suscribirInstalacion } from "@/lib/pwa/instalacion";
import { maneraDeInstalar, pasosParaInstalar, sistemaDe } from "@/lib/pwa-reglas";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

const sinOyente = () => () => {};

// «Instalar la app» en el menú. Donde el navegador deja, abre su diálogo con un toque; donde no (iPhone), dice los tres pasos.
// Si la app ya se abre desde el ícono de la pantalla de inicio, no aparece.
export function InstalarApp({ alElegir }: { alElegir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const idPasos = useId();
  const puedePedir = useSyncExternalStore(suscribirInstalacion, puedePedirInstalacion, () => false);
  const instalada = useSyncExternalStore(suscribirInstalacion, estaInstalada, () => false);
  const sistema = useSyncExternalStore(sinOyente, () => sistemaDe(navigator.userAgent, navigator.maxTouchPoints), () => "otro" as const);
  const manera = maneraDeInstalar({ instalada, puedePedir, sistema });

  if (manera === "instalada") return null;

  const alTocar = async () => {
    if (manera === "pedir") {
      const resultado = await pedirInstalacion();
      if (resultado === "aceptada") alElegir();
      else if (resultado === "no-disponible") setAbierto(true);
      return;
    }
    setAbierto((a) => !a);
  };

  const conPasos = manera === "pasos-ios" || manera === "pasos-menu";
  const mostrarPasos = abierto && (conPasos || manera === "pedir");
  const pasos = pasosParaInstalar(manera === "pasos-ios" ? "pasos-ios" : "pasos-menu");

  return (
    <div className="grid gap-2">
      <button type="button" onClick={alTocar} aria-expanded={conPasos ? abierto : undefined} aria-controls={conPasos ? idPasos : undefined} className={filaDelMenu}>
        <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
          <Smartphone aria-hidden className="size-6" />
        </span>
        Instalar la app
        {conPasos ? (
          <ChevronDown aria-hidden className={cn("size-6 text-texto-suave transition-transform duration-200", abierto && "rotate-180")} />
        ) : (
          <ChevronRight aria-hidden className="size-6 text-texto-suave" />
        )}
      </button>
      {mostrarPasos && (
        <ol id={idPasos} className="grid animate-pieza gap-2.5 rounded-control bg-superficie p-4">
          {pasos.map((paso, n) => (
            <li key={paso} className="grid grid-cols-[auto_1fr] items-start gap-3">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-acento/12 font-extrabold text-acento-texto">
                {n + 1}
              </span>
              <span>{paso}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
