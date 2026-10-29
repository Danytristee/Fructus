"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, LogOut, Menu, Settings } from "lucide-react";

import { salir } from "@/app/login/acciones";

// La hoja (Radix Dialog) pesa unos 10 KB y casi nadie abre el menú: se descarga recién al primer toque (ADR-0006).
const Hoja = dynamic(() => import("@/components/ui/Hoja").then((m) => m.Hoja), { ssr: false });

const fila =
  "grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-control bg-superficie px-4 text-left text-lg font-extrabold transition-transform active:scale-[0.98]";
const icono = "grid size-11 place-items-center rounded-2xl";

type Props = {
  nombre: string;
  rol: string;
  /** Lo decide el servidor con permisosDe(): aquí solo se obedece. */
  verCierre: boolean;
  verAjustes: boolean;
};

// El menú de arriba a la derecha: lo que no cabe en la barra de abajo, y quién entró.
export function MenuMas({ nombre, rol, verCierre, verAjustes }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [usado, setUsado] = useState(false);
  const cerrar = () => setAbierto(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUsado(true);
          setAbierto(true);
        }}
        aria-label="Menú: cierre del día, ajustes y salir"
        className="vidrio grid size-[52px] shrink-0 place-items-center rounded-full transition-transform duration-200 ease-salida active:scale-90"
      >
        {/* Tres líneas, no una tuerca: la tuerca se lee «configuración» y escondía el cierre del día (/formidable 2026-10-28). */}
        <Menu aria-hidden className="size-6" />
      </button>
      {usado && (
        <Hoja abierta={abierto} alCambiar={setAbierto} titulo="Más">
          <p className="mb-3 text-texto-suave">
            Entraste como <strong className="text-texto">{nombre}</strong> ({rol})
          </p>
          <nav aria-label="Más opciones" className="grid gap-2">
            {verCierre && (
              <Link href="/cierre" onClick={cerrar} className={fila}>
                <span className={`${icono} bg-exito-fondo text-exito`}>
                  <ClipboardCheck aria-hidden className="size-6" />
                </span>
                Cierre del día
                <ChevronRight aria-hidden className="size-6 text-texto-suave" />
              </Link>
            )}
            {verAjustes && (
              <Link href="/ajustes" onClick={cerrar} className={fila}>
                <span className={`${icono} bg-acento/12 text-acento-texto`}>
                  <Settings aria-hidden className="size-6" />
                </span>
                Ajustes
                <ChevronRight aria-hidden className="size-6 text-texto-suave" />
              </Link>
            )}
            <form action={salir}>
              <button type="submit" className={fila}>
                <span className={`${icono} bg-deuda-fondo text-deuda`}>
                  <LogOut aria-hidden className="size-6" />
                </span>
                Salir
                <span />
              </button>
            </form>
          </nav>
        </Hoja>
      )}
    </>
  );
}
