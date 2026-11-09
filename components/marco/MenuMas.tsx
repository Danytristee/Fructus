"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, LogOut, Menu, Settings } from "lucide-react";

import { salir } from "@/app/login/acciones";
import { InstalarApp } from "./InstalarApp";
import { filaDelMenu, iconoDelMenu } from "./menu-estilos";

// La hoja (Radix Dialog) pesa unos 10 KB y casi nadie abre el menú: se descarga recién al primer toque (ADR-0006).
const Hoja = dynamic(() => import("@/components/ui/Hoja").then((m) => m.Hoja), { ssr: false });
// Lo mismo con el aviso del día: su código se baja solo cuando se abre el menú, no con «Hoy».
const AvisoDelDia = dynamic(() => import("./AvisoDelDia").then((m) => m.AvisoDelDia), { ssr: false });

const fila = filaDelMenu;
const icono = iconoDelMenu;

type Props = {
  nombre: string;
  rol: string;
  /** Lo decide el servidor con permisosDe(): aquí solo se obedece. */
  verCierre: boolean;
  verAjustes: boolean;
  /** La clave pública del servidor para suscribir el teléfono al aviso del día; null si no está listo (no se ofrece). */
  clavePush: string | null;
};

// El menú de arriba a la derecha: lo que no cabe en la barra de abajo, y quién entró.
export function MenuMas({ nombre, rol, verCierre, verAjustes, clavePush }: Props) {
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
        className="grid size-[52px] shrink-0 place-items-center rounded-full border border-sobre-acento/20 bg-sobre-acento/10 text-sobre-acento transition-transform duration-200 ease-salida active:scale-90"
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
            {verCierre && clavePush && <AvisoDelDia clavePublica={clavePush} />}
            <InstalarApp alElegir={cerrar} />
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
