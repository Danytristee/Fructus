"use client";

import { useState } from "react";
import { Headphones } from "lucide-react";
import { cn } from "cn";

import { Aviso } from "@/components/ui/Aviso";
import { Interruptor } from "@/components/ui/Interruptor";
import { hablar } from "@/components/voz/hablar";
import { cambiarManosLibres, manosLibres, puedeHablar } from "@/components/voz/manos-libres";
import { vibrar } from "@/components/voz/senales";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

// «Manos libres» en el menú (ADR-0020): un interruptor que, en este celular, hace que Fructus lea cada venta en voz alta antes de
// guardarla. Al prenderlo dice una frase, para oír por dónde sale (el audífono, ojalá). Si el navegador no sabe hablar, no aparece.
export function ManosLibres() {
  // Se monta solo en el navegador (dynamic sin SSR, desde MenuMas): se puede leer el celular al empezar.
  const [activo, setActivo] = useState(manosLibres);
  const [sinGuardar, setSinGuardar] = useState(false);
  if (!puedeHablar()) return null;

  const alTocar = () => {
    const nuevo = !activo;
    if (!cambiarManosLibres(nuevo)) return setSinGuardar(true);
    setSinGuardar(false);
    setActivo(nuevo);
    vibrar(15);
    if (nuevo) hablar("Listo. Te voy a leer cada venta antes de guardarla.");
  };

  return (
    <div className="grid gap-2">
      <button type="button" role="switch" aria-checked={activo} onClick={alTocar} className={cn(filaDelMenu, "py-3")}>
        <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
          <Headphones aria-hidden className="size-6" />
        </span>
        <span className="grid">
          Manos libres
          <span className="text-base font-normal text-texto-suave">{activo ? "Activado: te leo cada venta" : "Te leo cada venta. Úsalo con audífono"}</span>
        </span>
        <Interruptor activo={activo} />
      </button>
      {sinGuardar && (
        <Aviso tipo="info" titulo="Este celular no pudo guardarlo">
          Pasa cuando el navegador está en modo privado. Ábrelo en una pestaña normal.
        </Aviso>
      )}
    </div>
  );
}
