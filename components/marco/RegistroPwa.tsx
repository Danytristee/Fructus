"use client";

import { useEffect } from "react";

import { escucharInstalacion } from "@/lib/pwa/instalacion";

// No dibuja nada. Al cargar la página: (1) deja al navegador avisar cuándo se puede instalar la app (se guarda para el menú «Más») y
// (2) en producción, registra el service worker que muestra «Sin conexión» cuando se abre sin señal (public/sw.js, ADR-0011).
// En desarrollo no se registra: un service worker metido en medio de `pnpm dev` confunde lo que se ve con lo que se escribió.
export function RegistroPwa() {
  useEffect(() => {
    escucharInstalacion();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Después de que la pantalla ya cargó: el registro no compite con lo que la persona está esperando ver.
    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error: unknown) => console.error("pwa: no se pudo registrar el service worker", { error: error instanceof Error ? error.name : "desconocido" }));
    };
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
    return () => window.removeEventListener("load", registrar);
  }, []);
  return null;
}
