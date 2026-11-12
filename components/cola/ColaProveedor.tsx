"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { agregar, listar, actualizar, quitar as quitarDelCelular } from "@/lib/cola/almacen";
import { esperaTras, siguiente, type Contenido, type Entrada, type Situacion } from "@/lib/cola-reglas";

type Cola = {
  /** Lo de esta persona, en orden. */
  entradas: Entrada[];
  situacion: Situacion;
  /** Guarda en el celular y, si hay señal, empieza a enviar. false si el celular no pudo guardarlo. */
  encolar: (contenido: Contenido, resumen: string) => Promise<boolean>;
  /** Saca una entrada: una tarjeta que la persona ya confirmó o descartó, o un rechazo descartado. */
  quitar: (id: number) => Promise<void>;
};

const Contexto = createContext<Cola | null>(null);

/** Lo que cambia de la cola a la vista: qué hay, en qué estado y de qué clase. */
const huella = (es: readonly Entrada[]) => es.map((e) => `${e.id}:${e.estado}:${e.contenido.clase}`).join(",");

/** La cola, o null fuera de las pantallas con sesión (la página de piezas): ahí no se encola nada. */
export const useCola = () => useContext(Contexto);

// Lo que dura «Listo: se envió lo guardado» antes de irse.
const LISTO_MS = 4_000;

/**
 * La cola sin conexión (ADR-0019), montada una vez en el layout. Lo que se confirma o se dicta sin señal se guarda en el
 * celular y se envía solo, en orden, apenas vuelve: al conectarse, al volver a la app y con reintentos que se espacian.
 * Un solo envío a la vez, también entre pestañas (Web Locks). El código que envía se baja recién cuando hay algo que
 * enviar: no pesa en la primera carga de «Hoy».
 */
export function ColaProveedor({ usuarioId, children }: { usuarioId: string; children: React.ReactNode }) {
  const [todas, setTodas] = useState<Entrada[]>([]);
  const [enLinea, setEnLinea] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [enviadas, setEnviadas] = useState(0);
  const corriendo = useRef(false);
  const intentos = useRef(0);
  const reintento = useRef(0);
  const listo = useRef(0);
  const router = useRouter();

  // Sin cambios, el mismo arreglo: un contexto nuevo mientras «Hoy» todavía llega del servidor hace que React rearme en el
  // celular las secciones que aún no hidrataron, y por un momento se veían dos veces (pruebas de voz y clientes, 2026-11-12).
  const refrescar = useCallback(async () => {
    const nuevas = await listar();
    setTodas((antes) => (huella(antes) === huella(nuevas) ? antes : nuevas));
  }, []);

  const vaciar = useCallback(async () => {
    let enviadasAhora = 0;
    for (;;) {
      if (!navigator.onLine) break;
      const e = siguiente(await listar(), usuarioId);
      if (!e) break;
      setEnviando(true);
      const { enviar } = await import("@/lib/cola/enviar");
      const d = await enviar(e);
      if (d.tipo === "reintentar") {
        intentos.current += 1;
        setEsperando(true);
        window.clearTimeout(reintento.current);
        reintento.current = window.setTimeout(() => void drenarRef.current(), esperaTras(intentos.current));
        break;
      }
      intentos.current = 0;
      setEsperando(false);
      if (d.tipo === "sin_sesion") {
        setSinSesion(true);
        break;
      }
      if (d.tipo === "hecho") {
        await quitarDelCelular(e.id);
        enviadasAhora += 1;
      } else if (d.tipo === "tarjeta") {
        await actualizar({ ...e, contenido: { clase: "por_confirmar", comandoId: d.comandoId, tarjeta: d.tarjeta, latenciaMs: d.latenciaMs } });
        enviadasAhora += 1;
      } else {
        await actualizar({ ...e, estado: "rechazada", error: d.error });
      }
      await refrescar();
    }
    setEnviando(false);
    await refrescar();
    if (enviadasAhora > 0) {
      setEnviadas(enviadasAhora);
      window.clearTimeout(listo.current);
      listo.current = window.setTimeout(() => setEnviadas(0), LISTO_MS);
      // «Hoy», el cuaderno y el stock se rearman con lo que acaba de entrar.
      startTransition(() => router.refresh());
    }
  }, [usuarioId, refrescar, router]);

  const drenar = useCallback(async () => {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      // Dos pestañas abiertas no envían a la vez (la base igual no duplicaría, pero el orden se respeta mejor así).
      if (navigator.locks) await navigator.locks.request("fructus-cola", { ifAvailable: true }, (lock) => (lock ? vaciar() : undefined));
      else await vaciar();
    } catch (e) {
      console.error("cola: falló el envío", { error: e instanceof Error ? e.name : "desconocido" });
    } finally {
      corriendo.current = false;
    }
  }, [vaciar]);
  const drenarRef = useRef(drenar);
  useEffect(() => {
    drenarRef.current = drenar;
  }, [drenar]);

  useEffect(() => {
    const alConectar = () => {
      setEnLinea(true);
      intentos.current = 0;
      void drenarRef.current();
    };
    const alDesconectar = () => setEnLinea(false);
    // Al volver a la app (otra pestaña pudo cambiar la cola, o la señal volvió mientras estaba en segundo plano).
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      setEnLinea(navigator.onLine);
      void refrescar().then(() => drenarRef.current());
    };
    // Recién con la página entera cargada (y lo que llega del servidor ya en su lugar), por la misma razón.
    const alCargar = () => {
      setEnLinea(navigator.onLine);
      void refrescar().then(() => drenarRef.current());
    };
    if (document.readyState === "complete") alCargar();
    else window.addEventListener("load", alCargar, { once: true });
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("load", alCargar);
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      document.removeEventListener("visibilitychange", alVolver);
      window.clearTimeout(reintento.current);
      window.clearTimeout(listo.current);
    };
  }, [refrescar]);

  const encolar = useCallback(
    async (contenido: Contenido, resumen: string) => {
      const id = await agregar({ usuarioId, creadoEn: Date.now(), estado: "pendiente", resumen, contenido });
      await refrescar();
      if (id !== null) void drenar();
      return id !== null;
    },
    [usuarioId, refrescar, drenar],
  );

  const quitar = useCallback(
    async (id: number) => {
      await quitarDelCelular(id);
      await refrescar();
      void drenar(); // un rechazo descartado deja pasar a las que esperaban detrás
    },
    [refrescar, drenar],
  );

  const valor = useMemo<Cola>(() => {
    const entradas = todas.filter((e) => e.usuarioId === usuarioId);
    const situacion: Situacion = {
      enLinea,
      porEnviar: entradas.filter((e) => e.estado === "pendiente" && e.contenido.clase !== "por_confirmar"),
      rechazada: entradas.find((e) => e.estado === "rechazada" && e.contenido.clase === "confirmacion") ?? null,
      enviando,
      esperando,
      sinSesion,
      enviadas,
    };
    return { entradas, situacion, encolar, quitar };
  }, [todas, usuarioId, enLinea, enviando, esperando, sinSesion, enviadas, encolar, quitar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
