"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, CloudUpload, TriangleAlert, WifiOff } from "lucide-react";
import { cn } from "cn";

import { franjaDe } from "@/lib/cola-reglas";
import { useCola } from "./ColaProveedor";

const TONOS = {
  // Sin señal y enviando: bosque profundo con texto marfil (15:1), se lee al sol y no se confunde con una tarjeta.
  sin_senal: { clase: "bg-profundo text-sobre-acento", icono: "text-lima", Icono: WifiOff },
  enviando: { clase: "bg-profundo text-sobre-acento", icono: "text-lima", Icono: CloudUpload },
  listo: { clase: "bg-exito-fondo text-exito", icono: "text-exito", Icono: CircleCheck },
  error: { clase: "bg-deuda-fondo text-deuda", icono: "text-deuda", Icono: TriangleAlert },
} as const;

/**
 * La franja de arriba que dice si hay señal y qué pasa con lo guardado en el celular (CLAUDE.md, regla 10; ADR-0017).
 * Pegada arriba mientras se desliza, en todas las pantallas con sesión. El color nunca va solo: icono y texto.
 */
export function FranjaConexion() {
  const cola = useCola();
  const router = useRouter();
  const franja = cola && franjaDe(cola.situacion);
  if (!cola || !franja) return null;
  const { clase, icono, Icono } = TONOS[franja.tono];
  const rechazada = cola.situacion.rechazada;

  return (
    <div
      role={franja.tono === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "sticky top-[max(8px,env(safe-area-inset-top))] z-40 mb-4 grid animate-subir grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-tarjeta px-4 py-3 shadow-[0_8px_24px_rgb(var(--sombra-color)/0.18)]",
        clase,
      )}
    >
      <Icono aria-hidden className={cn("mt-0.5 size-6", icono)} strokeWidth={2.4} />
      <div className="grid min-w-0 gap-0.5">
        <p className="font-extrabold [overflow-wrap:anywhere]">{franja.titulo}</p>
        {franja.detalle && <p className={franja.tono === "error" ? "text-texto" : undefined}>{franja.detalle}</p>}
      </div>
      {franja.accion && (
        <div className="col-span-2 flex flex-wrap justify-end gap-2">
          {franja.accion === "entrar" && (
            <BotonFranja onClick={() => router.push("/login")}>Entrar otra vez</BotonFranja>
          )}
          {franja.accion === "quitar" && rechazada && (
            <BotonFranja onClick={() => void cola.quitar(rechazada.id)}>Quitar de la lista</BotonFranja>
          )}
        </div>
      )}
    </div>
  );
}

function BotonFranja({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-12 rounded-full bg-acento px-5 font-extrabold text-sobre-acento transition-transform duration-150 active:scale-[0.97]"
    >
      {children}
    </button>
  );
}
