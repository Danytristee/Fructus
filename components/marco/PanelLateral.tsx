"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, House, Package, Receipt, Settings, Truck, Users } from "lucide-react";
import { cn } from "cn";

import { MenuMas } from "./MenuMas";

type Props = {
  nombre: string;
  rol: string;
  /** Lo decide el servidor con permisosDe(): aquí solo se obedece. */
  verCierre: boolean;
  verAjustes: boolean;
  clavePush: string | null;
};

const principales = [
  { href: "/", nombre: "Hoy", Icono: House },
  { href: "/clientes", nombre: "Clientes", Icono: Users },
  { href: "/stock", nombre: "Stock", Icono: Package },
  { href: "/ventas", nombre: "Ventas", Icono: Receipt },
] as const;

const esActual = (href: string, ruta: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));

// El marco de escritorio (desde 1024 px, ADR-0015): en vez de la barra de abajo y del menú de tres rayas, un panel verde a la izquierda con los
// cuatro destinos y, separados, Proveedores, Cierre y Ajustes, siempre a la vista. Abajo, quién entró y «Más» (el mismo menú del celular: aviso del día,
// instalar la app y salir). En celular no se dibuja: la barra de abajo sigue siendo la navegación.
export function PanelLateral({ nombre, rol, verCierre, verAjustes, clavePush }: Props) {
  const ruta = usePathname();
  const secundarios = [
    { href: "/proveedores", nombre: "Proveedores", Icono: Truck },
    ...(verCierre ? [{ href: "/cierre", nombre: "Cierre del día", Icono: ClipboardCheck }] : []),
    ...(verAjustes ? [{ href: "/ajustes", nombre: "Ajustes", Icono: Settings }] : []),
  ];
  const enlace = ({ href, nombre: n, Icono }: { href: string; nombre: string; Icono: typeof House }) => {
    const actual = esActual(href, ruta);
    return (
      <Link
        key={href}
        href={href}
        aria-current={actual ? "page" : undefined}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-extrabold transition-colors duration-150",
          actual ? "bg-lima text-sobre-lima" : "text-sobre-acento/85 hover:bg-sobre-acento/8 hover:text-sobre-acento",
        )}
      >
        <Icono aria-hidden className="size-[22px]" />
        {n}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Fructus"
      className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col gap-1.5 rounded-r-[28px] bg-[radial-gradient(120%_70%_at_20%_0%,var(--bosque-2),var(--acento)_45%,var(--profundo))] px-4 py-6 text-sobre-acento lg:flex"
    >
      <div className="mb-4 flex items-center gap-3 px-2">
        <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-[11px]" />
        <span className="text-[22px] font-extrabold tracking-tight">Fructus</span>
      </div>
      <nav aria-label="Principal" className="grid gap-1">
        {principales.map(enlace)}
        <hr className="mx-2 my-2.5 border-sobre-acento/15" />
        {secundarios.map(enlace)}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 rounded-2xl px-2 py-2">
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-extrabold">{nombre}</span>
          <span className="text-[15px] text-sobre-acento/75">{rol}</span>
        </span>
        <MenuMas nombre={nombre} rol={rol} verCierre={verCierre} verAjustes={verAjustes} clavePush={clavePush} />
      </div>
    </aside>
  );
}
