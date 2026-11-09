import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { nombreDelRol } from "@/lib/permisos-reglas";
import { clavePublicaParaElNavegador } from "@/lib/push/servidor";
import { exigirSesion } from "@/lib/sesion";
import { MenuMas } from "./MenuMas";

type Props = {
  titulo: string;
  subtitulo?: string;
  /** Una pantalla de segundo nivel (la ficha de un cliente) dice de dónde viene y vuelve con un toque. */
  volver?: { href: string; texto: string };
};

// La cabecera de cada pantalla con sesión: título grande a la izquierda y el menú a la derecha.
export async function Encabezado({ titulo, subtitulo, volver }: Props) {
  const { perfil, permisos } = await exigirSesion();
  return (
    <header className="mb-4 flex animate-subir items-center justify-between gap-3">
      <div className="min-w-0">
        {volver && (
          <Link href={volver.href} className="-ml-2 flex min-h-12 w-fit items-center gap-0.5 rounded-full pr-3 pl-1 font-bold text-texto-suave">
            <ChevronLeft aria-hidden className="size-6" />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-texto-suave">{subtitulo}</p>}
      </div>
      {/* Sin conexión no se sabe quién entró ni qué puede abrir: sin menú, en vez de un menú recortado que parezca el real. */}
      {permisos && (
        <MenuMas
          nombre={perfil?.nombre ?? ""}
          rol={perfil ? nombreDelRol(perfil.rol) : ""}
          verCierre={permisos.cierre}
          verAjustes={permisos.ajustes}
          clavePush={permisos.cierre ? clavePublicaParaElNavegador() : null}
        />
      )}
    </header>
  );
}
