"use client";

import { useState, useSyncExternalStore } from "react";
import { Ear } from "lucide-react";
import { cn } from "cn";

import { Aviso } from "@/components/ui/Aviso";
import { Interruptor } from "@/components/ui/Interruptor";
import { cambiarHolaFructus, holaFructus, puedeEscuchar } from "@/components/voz/hola-fructus";
import { alCambiarManosLibres, manosLibres, puedeHablar } from "@/components/voz/manos-libres";
import { vibrar } from "@/components/voz/senales";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

// «Hola Fructus» en el menú (actividad 5c): un interruptor que, en este celular, deja a «Hoy» escuchando la frase para dictar sin tocar
// el orbe. Va junto a «Manos libres»: cada uno quita un toque, y con los dos prendidos una venta no necesita ninguno. Si el navegador no
// puede escuchar (sin AudioWorklet o WebAssembly), no aparece.
export function HolaFructus() {
  // Se monta solo en el navegador (dynamic sin SSR, desde MenuMas): se puede leer el celular al empezar.
  const [activo, setActivo] = useState(holaFructus);
  const [sinGuardar, setSinGuardar] = useState(false);
  const conManosLibres = useSyncExternalStore(alCambiarManosLibres, manosLibres, () => false);
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
        {/* Qué toque quita: el de empezar a dictar (/formidable 2026-11-16, cambio 3). «Manos libres» quita el de confirmar. */}
        <span className="grid">
          «Hola Fructus»
          <span className="text-base font-normal text-texto-suave">
            {activo ? "Activado: en Hoy, di «Hola Fructus» y lo que pasó" : "Empiezo a escucharte cuando lo dices"}
          </span>
        </span>
        <Interruptor activo={activo} />
      </button>
      {/* El ciego prendió los dos «por si acaso» sin saber cuál era para no tocar nada: se dice qué falta. */}
      {activo && !conManosLibres && puedeHablar() && (
        <Aviso tipo="info" titulo="Para no tocar nada">
          Prende también «Manos libres»: te leo la venta y la confirmas hablando.
        </Aviso>
      )}
      {sinGuardar && (
        <Aviso tipo="info" titulo="Este celular no pudo guardarlo">
          Pasa cuando el navegador está en modo privado. Ábrelo en una pestaña normal.
        </Aviso>
      )}
    </div>
  );
}
