import { BarraInferior } from "@/components/marco/BarraInferior";
import { CuentaInactiva } from "@/components/marco/CuentaInactiva";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { EsperaProveedor } from "@/components/ui/Espera";
import { FondoAurora } from "@/components/ui/FondoAurora";
import { exigirSesion } from "@/lib/sesion";

// El marco de todas las pantallas con sesión: fondo, indicador de guardado y barra de abajo.
export default async function MarcoApp({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion();
  if (sesion.estado !== "activo") {
    return (
      <main className="mx-auto max-w-xl px-4">
        <FondoAurora />
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
      <FondoAurora />
      <main className="mx-auto max-w-xl px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(112px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BarraInferior />
    </EsperaProveedor>
  );
}
