"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Volume2 } from "lucide-react";
import { cn } from "cn";

import { Aviso } from "@/components/ui/Aviso";
import { hablar } from "@/components/voz/hablar";
import { puedeHablar } from "@/components/voz/manos-libres";
import { vibrar } from "@/components/voz/senales";
import { alCambiarVozGuardada, alCambiarVoces, guardarVoz, leerVoces, sinVoces, vozGuardada } from "@/components/voz/voces";
import { elegirVoz, etiquetaVoz, FRASE_DE_PRUEBA, vocesEnEspanol, type Voz } from "@/lib/voz/voces-reglas";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

// Cuántas se muestran de entrada: un iPhone o una Mac traen veinte voces en español, y la lista taparía el resto del menú.
const PRIMERAS = 6;

// «Voz de Fructus» en el menú: elegir, oyéndola, la voz del celular con que Fructus lee la venta y responde. Tocar una voz la elige y
// dice una venta de ejemplo: un toque, no dos. Se recuerda en este celular. Si el navegador no sabe hablar o no tiene voces en
// español, no aparece.
export function VozDeFructus() {
  const voces = useSyncExternalStore(alCambiarVoces, leerVoces, sinVoces);
  const guardada = useSyncExternalStore(alCambiarVozGuardada, vozGuardada, () => null);
  const [abierta, setAbierta] = useState(false);
  const [todas, setTodas] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);

  const enEspanol = vocesEnEspanol(voces);
  const actual = elegirVoz(voces, guardada);
  if (!puedeHablar() || !actual) return null;

  const probar = (v: Voz) => {
    setSinGuardar(!guardarVoz(v.uri));
    vibrar(15);
    hablar(FRASE_DE_PRUEBA, undefined, v);
  };
  const { nombre, detalle } = etiquetaVoz(actual);
  // La elegida se ve siempre, aunque esté más abajo de las primeras.
  const visibles = todas ? enEspanol : enEspanol.filter((v, i) => i < PRIMERAS || v.uri === actual.uri);

  return (
    <div className="grid gap-2">
      <button type="button" aria-expanded={abierta} onClick={() => setAbierta(!abierta)} className={cn(filaDelMenu, "py-3")}>
        <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
          <Volume2 aria-hidden className="size-6" />
        </span>
        <span className="grid">
          Voz de Fructus
          <span className="text-base font-normal text-texto-suave">
            {nombre} · {detalle}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("size-6 text-texto-suave transition-transform", abierta && "rotate-180")} />
      </button>
      {abierta && (
        <div className="grid gap-2 rounded-control bg-superficie p-2">
          <p className="px-2 pt-1 text-base text-texto-suave">Toca una para oírla. Queda elegida en este celular.</p>
          <div role="radiogroup" aria-label="Voz de Fructus" className="grid gap-1">
            {visibles.map((v) => {
              const e = etiquetaVoz(v);
              const elegida = v.uri === actual.uri;
              return (
                <button
                  key={v.uri}
                  type="button"
                  role="radio"
                  aria-checked={elegida}
                  onClick={() => probar(v)}
                  className={cn(
                    "grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-control px-3 text-left transition-transform active:scale-[0.98]",
                    elegida && "bg-acento/12",
                  )}
                >
                  <span className="grid">
                    <span className="text-lg font-extrabold">{e.nombre}</span>
                    <span className="text-base text-texto-suave">{e.detalle}</span>
                  </span>
                  {elegida ? <Check aria-hidden className="size-6 text-acento-texto" /> : <span className="size-6" />}
                </button>
              );
            })}
          </div>
          {enEspanol.length > visibles.length && (
            <button type="button" onClick={() => setTodas(true)} className="min-h-12 rounded-control px-3 text-left font-bold text-acento-texto">
              Ver las {enEspanol.length} voces
            </button>
          )}
          {/* En Android, Chrome suele traer una sola voz por país: las demás se instalan en el celular, no en Fructus. */}
          <p className="px-2 pb-1 text-base text-texto-suave">
            {enEspanol.length === 1 ? "Tu celular tiene una sola voz en español. " : "¿Ninguna te gusta? "}
            Instala otras en los ajustes del celular, en «Texto a voz».
          </p>
        </div>
      )}
      {sinGuardar && (
        <Aviso tipo="info" titulo="Este celular no pudo guardarla">
          Pasa cuando el navegador está en modo privado. Ábrelo en una pestaña normal.
        </Aviso>
      )}
    </div>
  );
}
