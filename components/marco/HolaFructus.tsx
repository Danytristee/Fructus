"use client";

import { useState } from "react";
import { Ear } from "lucide-react";
import { cn } from "cn";

import { Aviso } from "@/components/ui/Aviso";
import { Interruptor } from "@/components/ui/Interruptor";
import { cambiarHolaFructus, holaFructus, puedeEscuchar } from "@/components/voz/hola-fructus";
import { vibrar } from "@/components/voz/senales";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

// «Hola Fructus» en el menú (actividad 5c): un interruptor que, en este celular, deja a «Hoy» escuchando la frase para dictar sin tocar
// el orbe. Va junto a «Manos libres»: con los dos prendidos, una venta no necesita ningún toque. Si el navegador no puede escuchar
// (sin AudioWorklet o WebAssembly), no aparece.
export function HolaFructus() {
  // Se monta solo en el navegador (dynamic sin SSR, desde MenuMas): se puede leer el celular al empezar.
  const [activo, setActivo] = useState(holaFructus);
  const [sinGuardar, setSinGuardar] = useState(false);
  if (!puedeEscuchar()) return null;

  const alTocar = () => {
    const nuevo = !activo;
    if (!cambiarHolaFructus(nuevo)) return setSinGuardar(true);
    setSinGuardar(false);
    setActivo(nuevo);
    vibrar(15);
  };

  return (
    <div className="grid gap-2">
      <button type="button" role="switch" aria-checked={activo} onClick={alTocar} className={cn(filaDelMenu, "py-3")}>
        <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
          <Ear aria-hidden className="size-6" />
        </span>
        <span className="grid">
          «Hola Fructus»
          <span className="text-base font-normal text-texto-suave">
            {activo ? "Activado: en Hoy, di «Hola Fructus» y lo que pasó" : "Dicta sin tocar el celular"}
          </span>
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
