"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "cn";

import { activarAvisos, apagarAvisos, leerHoraDelAviso } from "@/app/(app)/acciones-avisos";
import { Aviso } from "@/components/ui/Aviso";
import { Interruptor } from "@/components/ui/Interruptor";
import { vibrar } from "@/components/voz/senales";
import { leerEstadoDelAviso, quitarSuscripcionDeEsteTelefono, suscribirEsteTelefono } from "@/lib/push/navegador";
import { textoDeLaHora, type HoraDeCierre } from "@/lib/hora-cierre-reglas";
import type { EstadoDelAviso } from "@/lib/push-reglas";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

type Estado = EstadoDelAviso | "revisando";
type Mensaje = { tipo: "exito" | "info" | "error"; titulo: string; texto?: string };

/** La hora la elige el dueño en Ajustes (ADR-0023). Si no se pudo leer, se dice «al cerrar» en vez de una hora que quizá no es. */
function subtitulo(estado: Estado, hora: HoraDeCierre | null): string {
  const cuando = hora === null ? "al cerrar" : textoDeLaHora(hora);
  switch (estado) {
    case "revisando":
      return "Revisando…";
    case "apagado":
      return `Lo que vendiste, ${cuando}`;
    case "activo":
      return `Activado, ${cuando}`;
    case "bloqueado":
      return "Bloqueado en tu teléfono";
    case "instalar-primero":
      return "Primero instala la app";
    case "no-disponible":
      return "";
  }
}

// «Aviso del día» en el menú: un interruptor que le manda al teléfono, cada noche, lo vendido, lo cobrado y lo que le deben (ADR-0013).
// Al activarlo sale un aviso de prueba, para ver en la pantalla cómo llega. Si el teléfono no puede (iPhone sin instalar la app, permiso
// bloqueado, navegador sin avisos), lo dice en vez de ofrecer un interruptor que no hace nada. Sin soporte, no aparece.
export function AvisoDelDia({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("revisando");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [hora, setHora] = useState<HoraDeCierre | null>(null);

  useEffect(() => {
    let vigente = true;
    // A la par del estado del teléfono: la hora vive en la base y se pide al abrir el menú, no en cada pantalla.
    leerHoraDelAviso()
      .then((h) => vigente && setHora(h))
      .catch((error: unknown) => console.error("avisos: no se pudo leer la hora", { error: error instanceof Error ? error.name : "desconocido" }));
    leerEstadoDelAviso()
      .then((lectura) => {
        if (!vigente) return;
        setEstado(lectura.estado);
        setEndpoint(lectura.endpoint);
      })
      .catch((error: unknown) => {
        console.error("avisos: no se pudo leer el estado", { error: error instanceof Error ? error.name : "desconocido" });
        if (vigente) setEstado("no-disponible");
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (estado === "no-disponible") return null;

  const activar = async () => {
    // El permiso se pide primero, dentro del toque: el navegador no lo deja pedir después de esperar al servidor.
    const suscrito = await suscribirEsteTelefono(clavePublica);
    if (!suscrito.ok) {
      if (suscrito.motivo === "bloqueado") setEstado("bloqueado");
      else if (suscrito.motivo === "cerrado") setMensaje({ tipo: "info", titulo: "No activaste el aviso", texto: "Cuando quieras, vuelve a tocar «Aviso del día»." });
      else if (suscrito.motivo === "no-disponible") setEstado("no-disponible");
      else setMensaje({ tipo: "error", titulo: "No pudimos activar el aviso", texto: "Inténtalo otra vez. Si sigue igual, cierra la app y ábrela de nuevo." });
      return;
    }
    const servidor = await activarAvisos(suscrito.suscripcion);
    if (!servidor.ok) {
      // El servidor no la guardó: no debe quedar una suscripción en el teléfono que él no conoce (diría «Activado» sin avisar nada).
      await quitarSuscripcionDeEsteTelefono();
      setMensaje({ tipo: "error", titulo: "No pudimos activar el aviso", texto: servidor.error });
      return;
    }
    vibrar(30);
    setEstado("activo");
    setEndpoint(suscrito.suscripcion.endpoint ?? null);
    setMensaje(
      servidor.prueba === "llego"
        ? { tipo: "exito", titulo: "Aviso activado", texto: "Te mandamos uno de prueba: míralo en tu teléfono." }
        : { tipo: "info", titulo: "Aviso activado", texto: "El aviso de prueba no llegó. Si esta noche no te llega, avísale a quien administra la app." },
    );
  };

  const apagar = async () => {
    // Primero se le dice al servidor: si no se puede (sin señal), el aviso sigue activo y se dice, en vez de quedar a medias.
    if (endpoint) {
      const servidor = await apagarAvisos({ endpoint });
      if (!servidor.ok) {
        setMensaje({ tipo: "error", titulo: "No pudimos apagar el aviso", texto: servidor.error });
        return;
      }
    }
    await quitarSuscripcionDeEsteTelefono();
    setEstado("apagado");
    setEndpoint(null);
    setMensaje({ tipo: "info", titulo: "Aviso apagado", texto: "Ya no te mandaremos el resumen del día a este teléfono." });
  };

  const alTocar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await (estado === "activo" ? apagar() : activar());
    } catch (error) {
      // Se cortó la señal al hablar con el servidor (la acción lanza en vez de contestar): se dice y no queda nada a medias. Al activar, la
      // suscripción que ya se hizo en el teléfono se deshace; al apagar, el aviso sigue activado, que es lo que el servidor todavía cree.
      console.error("avisos: no se pudo hablar con el servidor", { error: error instanceof Error ? error.name : "desconocido" });
      if (estado !== "activo") await quitarSuscripcionDeEsteTelefono();
      setMensaje({ tipo: "error", titulo: estado === "activo" ? "No pudimos apagar el aviso" : "No pudimos activar el aviso", texto: "Revisa tu señal e inténtalo otra vez." });
    } finally {
      setOcupado(false);
    }
  };

  const activo = estado === "activo";
  const interactivo = estado === "apagado" || estado === "activo";
  const contenido = (
    <>
      <span className={`${iconoDelMenu} bg-acento/12 text-acento-texto`}>
        <Bell aria-hidden className="size-6" />
      </span>
      <span className="grid">
        Aviso del día
        <span className="text-base font-normal text-texto-suave">{subtitulo(estado, hora)}</span>
      </span>
      {/* El interruptor: la posición de la perilla y el texto de arriba dicen lo mismo, para que el color no sea la única señal. */}
      <Interruptor activo={activo} />
    </>
  );

  return (
    <div className="grid gap-2">
      {interactivo ? (
        <button type="button" role="switch" aria-checked={activo} aria-busy={ocupado || undefined} disabled={ocupado} onClick={alTocar} className={cn(filaDelMenu, "py-3 disabled:opacity-100")}>
          {contenido}
        </button>
      ) : (
        <div className={cn(filaDelMenu, "py-3 active:scale-100")}>{contenido}</div>
      )}
      {estado === "bloqueado" && (
        <Aviso tipo="info" titulo="Los avisos están bloqueados">
          Entra a los ajustes de tu navegador, busca los permisos de Fructus y permite las notificaciones.
        </Aviso>
      )}
      {estado === "instalar-primero" && (
        <Aviso tipo="info" titulo="En iPhone, los avisos llegan solo a la app instalada">
          Toca «Instalar la app» aquí abajo.
        </Aviso>
      )}
      {mensaje && (
        <Aviso tipo={mensaje.tipo} titulo={mensaje.titulo}>
          {mensaje.texto}
        </Aviso>
      )}
    </div>
  );
}
