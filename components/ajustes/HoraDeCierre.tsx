"use client";

import { useState } from "react";
import { Check, ChevronRight, Clock } from "lucide-react";
import { cn } from "cn";

import { fijarHoraDeCierre } from "@/app/(app)/ajustes/acciones";
import { Aviso } from "@/components/ui/Aviso";
import { useEspera } from "@/components/ui/Espera";
import { Hoja } from "@/components/ui/Hoja";
import { vibrar } from "@/components/voz/senales";
import { formatearHora } from "@/lib/formato";
import { HORAS_DE_CIERRE, textoDeLaHora } from "@/lib/hora-cierre-reglas";

type Mensaje = { tipo: "exito" | "error"; titulo: string; texto?: string };

// La hora de cierre del puesto (ADR-0023): a esa hora le llega a cada teléfono el resumen del día. En Ajustes es un solo renglón arriba
// (con 58 frutas en el catálogo, una sección al final no la encontraba nadie); al tocarlo sube una hoja con las 16 horas a la vista.
// Un toque en una hora la guarda y cierra la hoja: sin teclado ni botón «Guardar», porque es reversible (otro toque la cambia).
// La elegida se marca con el relleno Y con un visto, para que el color no sea la única señal.
export function HoraDeCierre({ horaInicial }: { horaInicial: number }) {
  const esperar = useEspera();
  const [hora, setHora] = useState(horaInicial);
  const [abierta, setAbierta] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  const elegir = async (nueva: number) => {
    if (nueva === hora) {
      setAbierta(false);
      return;
    }
    setMensaje(null);
    try {
      const r = await esperar(fijarHoraDeCierre(nueva));
      if (!r.ok) {
        setMensaje({ tipo: "error", titulo: "No se cambió la hora", texto: r.error });
        return;
      }
      // Nada optimista: la hora nueva se marca cuando la base respondió.
      vibrar(30);
      setHora(r.hora);
      setAbierta(false);
      setMensaje({
        tipo: "exito",
        titulo: `Listo: el resumen te llega ${textoDeLaHora(r.hora)}`,
        texto: r.desde === "hoy" ? "Desde hoy." : "Hoy ya pasó esa hora: empieza mañana.",
      });
    } catch (error) {
      // Se cortó la señal (la acción lanza en vez de contestar): la hora sigue siendo la de antes.
      console.error("ajustes: no se pudo hablar con el servidor", { error: error instanceof Error ? error.name : "desconocido" });
      setMensaje({ tipo: "error", titulo: "No se cambió la hora", texto: "Revisa tu señal e inténtalo otra vez." });
    }
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => {
          setMensaje(null);
          setAbierta(true);
        }}
        className="vidrio grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-tarjeta px-4 py-3 text-left transition-transform duration-150 ease-salida active:scale-[0.98]"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-acento/12 text-acento-texto">
          <Clock aria-hidden className="size-6" />
        </span>
        <span className="grid">
          <span className="font-extrabold">Hora de cierre</span>
          <span className="text-texto-suave">El resumen del día te llega {textoDeLaHora(hora)}</span>
        </span>
        <ChevronRight aria-hidden className="size-6 text-texto-suave" />
      </button>
      {mensaje && (
        <Aviso tipo={mensaje.tipo} titulo={mensaje.titulo}>
          {mensaje.texto}
        </Aviso>
      )}
      <Hoja abierta={abierta} alCambiar={setAbierta} titulo="¿A qué hora cierras?" icono={<Clock aria-hidden className="size-5" />}>
        <p className="mb-4 text-texto-suave">A esa hora le llega a cada teléfono el resumen del día: lo vendido, lo cobrado y lo que te deben.</p>
        <div role="group" aria-label="Hora de cierre" className="grid grid-cols-4 gap-2">
          {HORAS_DE_CIERRE.map((h) => {
            const elegida = h === hora;
            return (
              <button
                key={h}
                type="button"
                aria-pressed={elegida}
                onClick={() => void elegir(h)}
                className={cn(
                  "relative inline-flex min-h-14 items-center justify-center rounded-full px-1 font-extrabold whitespace-nowrap tabular-nums transition-[background-color,color,transform] duration-200 ease-salida active:scale-95",
                  elegida ? "bg-acento text-sobre-acento" : "bg-texto/6 text-texto",
                )}
              >
                {formatearHora(h)}
                {/* El visto va en la esquina y no al lado del texto: a 360 px «✓ 11 p. m.» no cabía en la píldora. */}
                {elegida && (
                  <span aria-hidden className="absolute -top-1.5 -right-1 grid size-6 place-items-center rounded-full bg-lima text-profundo ring-2 ring-fondo">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-texto-suave">Llega dentro de esa hora, no en punto.</p>
      </Hoja>
    </div>
  );
}
