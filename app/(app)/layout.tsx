import { BarraInferior } from "@/components/marco/BarraInferior";
import { CuentaInactiva } from "@/components/marco/CuentaInactiva";
import { EsperaProveedor } from "@/components/ui/Espera";
import { FondoAurora } from "@/components/ui/FondoAurora";
import { exigirSesion } from "@/lib/sesion";

// El marco de todas las pantallas con sesión: fondo, indicador de guardado y barra de abajo.
export default async function MarcoApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirSesion();
  if (!perfil) {
    return (
      <main className="mx-auto max-w-xl px-4">
        <FondoAurora />
        <CuentaInactiva />
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
