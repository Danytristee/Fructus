import { nombreDelRol } from "@/lib/permisos-reglas";
import { exigirSesion } from "@/lib/sesion";
import { MenuMas } from "./MenuMas";

type Props = { titulo: string; subtitulo?: string };

// La cabecera de cada pantalla con sesión: título grande a la izquierda y el menú a la derecha.
export async function Encabezado({ titulo, subtitulo }: Props) {
  const { perfil, permisos } = await exigirSesion();
  return (
    <header className="mb-4 flex animate-subir items-center justify-between gap-3">
      <div className="min-w-0">
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
        />
      )}
    </header>
  );
}
