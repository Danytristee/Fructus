"use client";

import { useRef, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";

import { fijarHoraDeCierre } from "@/app/(app)/ajustes/acciones";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { BotonEnlace } from "@/components/ui/BotonEnlace";
import { useEspera } from "@/components/ui/Espera";
import { Hoja } from "@/components/ui/Hoja";
import { ALTO_DE_LA_RUEDA, Rueda } from "@/components/ui/Rueda";
import { sonarGuardado, vibrar } from "@/components/voz/senales";
import { HORAS_DE_CIERRE, MINUTOS_DE_CIERRE, horaDeReloj, periodoDe, textoDeLaHora, type HoraDeCierre as Hora } from "@/lib/hora-cierre-reglas";

type Mensaje = { tipo: "exito" | "error"; titulo: string; texto?: string; sinSesion?: boolean; verCierre?: boolean };

const HORAS = HORAS_DE_CIERRE.map((h) => ({ valor: h, etiqueta: String(horaDeReloj(h)) }));
const MINUTOS = MINUTOS_DE_CIERRE.map((m) => ({ valor: m, etiqueta: String(m).padStart(2, "0") }));

// La hora de cierre del puesto (ADR-0023, ADR-0024): a esa hora y minuto le llega a cada teléfono el resumen del día.
// En Ajustes es un solo renglón arriba (con 58 frutas, una sección al final no la encontraba nadie). Al tocarlo sube una hoja con un
// reloj de dos ruedas, horas y minutos, que se giran con el dedo; abajo se lee en una frase lo que va a pasar («Te llega todos los
// días a las 4:30 p. m.») y «Guardar» está en la zona del pulgar. Las ruedas no guardan solas: girar es probar, Guardar es decidir.
export function HoraDeCierre({ horaInicial }: { horaInicial: Hora }) {
  const esperar = useEspera();
  const [hora, setHora] = useState(horaInicial);
  const [borrador, setBorrador] = useState(horaInicial);
  const [abierta, setAbierta] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [errorEnHoja, setErrorEnHoja] = useState<Mensaje | null>(null);
  // Un segundo toque en Guardar mientras la base contesta no manda otro pedido (/chaos 2026-11-17).
  const guardando = useRef(false);

  const abrir = () => {
    setMensaje(null);
    setErrorEnHoja(null);
    setBorrador(hora);
    setAbierta(true);
  };

  const guardar = async () => {
    if (guardando.current) return;
    if (borrador.hora === hora.hora && borrador.minuto === hora.minuto) {
      setAbierta(false);
      return;
    }
    guardando.current = true;
    setErrorEnHoja(null);
    try {
      const r = await esperar(fijarHoraDeCierre(borrador));
      if (!r.ok) {
        // El error se dice dentro de la hoja, que sigue abierta: atrás, detrás del velo, no se veía (/chaos 2026-11-17).
        setErrorEnHoja({ tipo: "error", titulo: "No se cambió la hora", texto: r.error, sinSesion: r.sinSesion });
        return;
      }
      // Nada optimista: la hora nueva se muestra cuando la base respondió.
      vibrar(30);
      sonarGuardado();
      setHora(r.hora);
      setAbierta(false);
      setMensaje({
        tipo: "exito",
        titulo: `Listo: el resumen te llega ${textoDeLaHora(r.hora)}`,
        texto: r.desde === "hoy" ? "Desde hoy." : "Hoy ya pasó esa hora: empieza mañana.",
        verCierre: r.desde === "mañana",
      });
    } catch (error) {
      // Se cortó la señal (la acción lanza en vez de contestar): la hora sigue siendo la de antes.
      console.error("ajustes: no se pudo hablar con el servidor", { error: error instanceof Error ? error.name : "desconocido" });
      setErrorEnHoja({ tipo: "error", titulo: "No se cambió la hora", texto: "Revisa tu señal e inténtalo otra vez." });
    } finally {
      guardando.current = false;
    }
  };

  const periodo = periodoDe(borrador);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={abrir}
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
        <Aviso
          tipo={mensaje.tipo}
          titulo={mensaje.titulo}
          accion={
            mensaje.verCierre && (
              // La duda del ciego (/formidable 2026-11-17): «si quería el resumen hoy, ¿cómo lo consigo?». Está en el cierre.
              <BotonEnlace href="/cierre" variante="texto" className="-ml-5 justify-self-start text-acento-texto">
                Ver el cierre de hoy
              </BotonEnlace>
            )
          }
        >
          {mensaje.texto}
        </Aviso>
      )}
      <Hoja abierta={abierta} alCambiar={setAbierta} titulo="¿A qué hora cierras?" icono={<Clock aria-hidden className="size-5" />}>
        <p className="text-texto-suave">A esa hora le llega a cada teléfono el resumen del día: lo vendido, lo cobrado y lo que te deben.</p>

        {/* El reloj: dos ruedas y el periodo, sobre una sola franja que marca la hora elegida. */}
        <div className="relative mx-auto my-3 grid grid-cols-[84px_20px_84px_76px] items-center">
          <div
            aria-hidden
            style={{ height: ALTO_DE_LA_RUEDA }}
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-acento/10 ring-1 ring-acento/15"
          />
          <Rueda etiqueta="Hora" opciones={HORAS} valor={borrador.hora} alCambiar={(h) => setBorrador((b) => ({ ...b, hora: h }))} />
          <span aria-hidden className="relative -mt-1 text-center text-[32px] font-extrabold text-texto">
            :
          </span>
          <Rueda etiqueta="Minutos" opciones={MINUTOS} valor={borrador.minuto} alCambiar={(m) => setBorrador((b) => ({ ...b, minuto: m }))} />
          {/* El periodo sigue a la hora: entra desde abajo cuando cambia (a. m. → p. m.). */}
          <span key={periodo} aria-hidden className="relative animate-subir text-center text-2xl font-extrabold text-acento-texto">
            {periodo}
          </span>
        </div>

        <p aria-live="polite" className="text-center text-lg">
          Te llega todos los días <strong className="font-extrabold whitespace-nowrap">{textoDeLaHora(borrador)}</strong>
        </p>

        {errorEnHoja && (
          <Aviso
            tipo="error"
            titulo={errorEnHoja.titulo}
            className="mt-3"
            accion={
              errorEnHoja.sinSesion && (
                <BotonEnlace href="/login" variante="texto" className="-ml-5 justify-self-start text-deuda">
                  Entrar otra vez
                </BotonEnlace>
              )
            }
          >
            {errorEnHoja.texto}
          </Aviso>
        )}

        <Boton className="mt-4" onClick={() => void guardar()}>
          Guardar
        </Boton>
      </Hoja>
    </div>
  );
}
