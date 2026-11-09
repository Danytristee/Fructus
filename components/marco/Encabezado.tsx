import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { nombreDelRol } from "@/lib/permisos-reglas";
import { clavePublicaParaElNavegador } from "@/lib/push/servidor";
import { exigirSesion } from "@/lib/sesion";
import { MangoCabecera } from "./MangoCabecera";
import { MenuMas } from "./MenuMas";

type Props = {
  titulo: string;
  subtitulo?: string;
  /** Una pantalla de segundo nivel (la ficha de un cliente) dice de dónde viene y vuelve con un toque. */
  volver?: { href: string; texto: string };
  /** La pantalla principal («Hoy») lleva la marca y el mango; las demás, solo su título (ADR-0014). */
  marca?: boolean;
  /**
   * La pantalla empieza con una tarjeta: el verde se extiende 44 px hacia abajo y la tarjeta se monta encima. Sin esto el verde termina antes
   * y el contenido empieza sobre el marfil. No es el valor por defecto a propósito: un título suelto («Tus frutas» en Ajustes) quedaba
   * oscuro sobre verde y no se leía. Solo lo pide una pantalla cuya primera pieza es SIEMPRE una tarjeta (también al cargar o si falla).
   */
  sobreTarjeta?: boolean;
};

// La cabecera verde bosque de cada pantalla con sesión: título grande con la barra lima a la izquierda y el menú a la derecha. Ocupa todo el
// ancho y llega hasta arriba (debajo de la barra del teléfono). Con `sobreTarjeta`, la primera tarjeta de la pantalla se monta 44 px sobre el verde.
// Ojo: solo el FONDO verde va detrás del contenido (z-index negativo, decorativo). Si toda la cabecera fuera detrás, el menú se vería pero
// no se podría tocar: el navegador le da el toque a la capa de adelante (pasó en la primera versión).
export async function Encabezado({ titulo, subtitulo, volver, marca = false, sobreTarjeta = false }: Props) {
  const { perfil, permisos } = await exigirSesion();
  // Sin conexión no se sabe quién entró ni qué puede abrir: sin menú, en vez de un menú recortado que parezca el real.
  const menu = permisos && (
    <MenuMas
      nombre={perfil?.nombre ?? ""}
      rol={perfil ? nombreDelRol(perfil.rol) : ""}
      verCierre={permisos.cierre}
      verAjustes={permisos.ajustes}
      clavePush={permisos.cierre ? clavePublicaParaElNavegador() : null}
    />
  );
  return (
    <header className={"relative -mx-4 -mt-[max(16px,env(safe-area-inset-top))] px-4 pt-[max(14px,env(safe-area-inset-top))] text-sobre-acento " + (sobreTarjeta ? "mb-4" : "mb-9")}>
      <div
        aria-hidden
        className={"pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden rounded-b-[30px] " + (!sobreTarjeta ? "-bottom-5" : marca ? "-bottom-16" : "-bottom-[60px]") + "  bg-[radial-gradient(120%_90%_at_85%_0%,var(--bosque-2)_0%,var(--acento)_48%,var(--profundo)_100%)]"}
      >
        {marca && <MangoCabecera />}
      </div>
      {(marca || volver) && (
        <div className="relative flex min-h-[52px] items-center justify-between gap-3">
          {marca ? (
            <div className="flex items-center gap-2.5">
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={46}
                height={46}
                priority
                className="rounded-xl shadow-[0_0_0_1px_color-mix(in_srgb,var(--sobre-acento)_14%,transparent),0_6px_16px_rgb(var(--sombra-color)/0.45)]"
              />
              {/* Sin bajada «venta mayorista de frutas»: a 11 px no se leía al sol, y el ícono y el nombre ya dicen qué es (/formidable 2026-11-09). */}
              <p className="text-[26px] leading-none font-extrabold tracking-tight">Fructus</p>
            </div>
          ) : (
            volver && (
              <Link href={volver.href} className="-ml-2 flex min-h-12 w-fit items-center gap-0.5 rounded-full pr-3 pl-1 font-bold text-sobre-acento/80">
                <ChevronLeft aria-hidden className="size-6" />
                {volver.texto}
              </Link>
            )
          )}
          {menu}
        </div>
      )}
      <div className={"relative flex items-start justify-between gap-3 " + (marca ? "mt-4" : volver ? "mt-1" : "")}>
        <div className="min-w-0 animate-subir border-l-4 border-lima pl-3.5">
          <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-sobre-acento/80">{subtitulo}</p>}
        </div>
        {!marca && !volver && menu}
      </div>
    </header>
  );
}
