"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Volume2 } from "lucide-react";
import { cn } from "cn";

import { Aviso } from "@/components/ui/Aviso";
import { hablar } from "@/components/voz/hablar";
import { puedeHablar } from "@/components/voz/manos-libres";
import { vibrar } from "@/components/voz/senales";
import { alCambiarVozGuardada, alCambiarVoces, guardarVoz, leerVoces, sinVoces, vozGuardada } from "@/components/voz/voces";
import { elegirVoz, etiquetarVoces, FRASE_DE_PRUEBA, vocesEnEspanol, type Opcion } from "@/lib/voz/voces-reglas";
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
  // La que se acaba de tocar: el ciego no sabía si había quedado, y extrañaba un «Guardar» (/formidable 2026-11-17).
  const [recien, setRecien] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);

  const opciones = etiquetarVoces(vocesEnEspanol(voces));
  const actualVoz = elegirVoz(voces, guardada);
  const actual = opciones.find((o) => o.voz.uri === actualVoz?.uri);
  if (!puedeHablar() || !actual) return null;

  const alternar = () => {
    const abrir = !abierta;
    setAbierta(abrir);
    if (!abrir) return setRecien(null);
    // La fila está abajo en el menú y la lista abría fuera de la vista: se baja sola hasta ella. El clic ya dejó la lista en la página.
    requestAnimationFrame(() => {
      const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
      lista.current?.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
    });
  };
  const probar = (o: Opcion) => {
    const guardo = guardarVoz(o.voz.uri);
    setSinGuardar(!guardo);
    setRecien(guardo ? o.nombre : null);
    vibrar(15);
    hablar(FRASE_DE_PRUEBA, undefined, o.voz);
  };
  // La elegida se ve siempre, aunque esté más abajo de las primeras.
  const visibles = todas ? opciones : opciones.filter((o, i) => i < PRIMERAS || o === actual);

  return (
    <div className="grid gap-2">
      <button type="button" aria-expanded={abierta} onClick={alternar} className={cn(filaDelMenu, "py-3")}>
        <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
          <Volume2 aria-hidden className="size-6" />
        </span>
        <span className="grid">
          Voz de Fructus
          <span className="text-base font-normal text-texto-suave">
            {actual.nombre} · {actual.detalle}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("size-6 text-texto-suave transition-transform", abierta && "rotate-180")} />
      </button>
      {abierta && (
        <div ref={lista} className="grid gap-2 rounded-control bg-superficie p-2">
          <p aria-live="polite" className={cn("px-2 pt-1 text-base", recien ? "font-bold text-acento-texto" : "text-texto-suave")}>
            {recien ? `Listo: te leo las ventas con ${recien}.` : "Toca una para oírla. Queda elegida en este celular."}
          </p>
          <div role="radiogroup" aria-label="Voz de Fructus" className="grid gap-2">
            {visibles.map((o) => {
              const elegida = o === actual;
              return (
                <button
                  key={o.voz.uri}
                  type="button"
                  role="radio"
                  aria-checked={elegida}
                  onClick={() => probar(o)}
                  className={cn(
                    "grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-control border px-3 py-1 text-left transition-transform active:scale-[0.98]",
                    elegida ? "border-acento bg-acento/12" : "border-linea bg-fondo",
                  )}
                >
                  <span className="grid">
                    <span className="text-lg font-extrabold">{o.nombre}</span>
                    {/* Sobre el verde de la elegida, el gris suave baja a 5.9:1: ahí va el texto pleno. */}
                    <span className={cn("text-base", elegida ? "text-texto" : "text-texto-suave")}>{o.detalle}</span>
                  </span>
                  {/* El parlante dice «toca y suena»; el ✓, cuál quedó. */}
                  {elegida ? (
                    <Check aria-hidden className="size-6 text-acento-texto" />
                  ) : (
                    <Volume2 aria-hidden className="size-6 text-texto-suave" />
                  )}
                </button>
              );
            })}
          </div>
          {opciones.length > visibles.length && (
            <button type="button" onClick={() => setTodas(true)} className="min-h-12 rounded-control px-3 text-left font-bold text-acento-texto">
              Ver las {opciones.length} voces
            </button>
          )}
          {/* En Android, Chrome suele traer una sola voz por país: las demás se instalan en el celular, no en Fructus. */}
          <p className="px-2 pb-1 text-base text-texto-suave">
            {opciones.length === 1 ? "Tu celular tiene una sola voz en español. " : "¿Ninguna te gusta? "}
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
