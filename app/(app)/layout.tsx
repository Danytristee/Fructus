import { BarraInferior } from "@/components/marco/BarraInferior";
import { PanelLateral } from "@/components/marco/PanelLateral";
import { ColaProveedor } from "@/components/cola/ColaProveedor";
import { FranjaConexion } from "@/components/cola/FranjaConexion";
import { CuentaInactiva } from "@/components/marco/CuentaInactiva";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { EsperaProveedor } from "@/components/ui/Espera";
import { nombreDelRol } from "@/lib/permisos-reglas";
import { clavePublicaParaElNavegador } from "@/lib/push/servidor";
import { exigirSesion } from "@/lib/sesion";

// El marco de todas las pantallas con sesión: indicador de guardado y navegación. En celular, la barra de abajo; desde 1024 px, el panel lateral
// verde (ADR-0015) y el contenido más ancho.
export default async function MarcoApp({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion();
  if (sesion.estado !== "activo") {
    return (
      <main className="mx-auto max-w-xl px-4">
        {sesion.estado === "inactivo" ? (
          <CuentaInactiva />
        ) : (
          // La base no respondió: no se sabe si la cuenta está activa, así que no se le pide acceso a nadie.
          // En celular el aviso baja a la zona del pulgar (C1); en escritorio queda al centro.
          <div className="grid min-h-dvh content-end pb-[calc(40px+env(safe-area-inset-bottom))] sm:min-h-[70dvh] sm:content-center sm:pb-0">
            <SesionSinConexion />
          </div>
        )}
      </main>
    );
  }
  return (
    <EsperaProveedor>
      {/* La cola sin conexión (ADR-0019): lo confirmado o dictado sin señal se guarda en el celular y se envía solo, en orden. */}
      <ColaProveedor usuarioId={sesion.usuarioId}>
        {sesion.permisos && (
          <PanelLateral
            nombre={sesion.perfil?.nombre ?? ""}
            rol={sesion.perfil ? nombreDelRol(sesion.perfil.rol) : ""}
            verCierre={sesion.permisos.cierre}
            verAjustes={sesion.permisos.ajustes}
            clavePush={sesion.permisos.cierre ? clavePublicaParaElNavegador() : null}
          />
        )}
        <main className="mx-auto max-w-xl px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(112px+env(safe-area-inset-bottom))] lg:relative lg:mr-auto lg:ml-[264px] lg:max-w-[1240px] lg:px-10 lg:pt-8 lg:pb-16">
          <FranjaConexion />
          {children}
        </main>
        <BarraInferior />
      </ColaProveedor>
    </EsperaProveedor>
  );
}
