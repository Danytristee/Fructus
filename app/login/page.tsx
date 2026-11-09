import type { Metadata } from "next";

import { Aviso } from "@/components/ui/Aviso";
import { PantallaDeAcceso } from "@/components/marco/PantallaDeAcceso";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar · Fructus" };

export default async function Login({ searchParams }: { searchParams: Promise<{ enlace?: string }> }) {
  const { enlace } = await searchParams;
  return (
    <PantallaDeAcceso
      titulo="Fructus"
      subtitulo="Tus ventas, deudas y stock, por voz."
      aviso={
        enlace === "vencido" && (
          <Aviso titulo="Ese enlace ya no sirve">Los enlaces sirven una sola vez y por una hora. Pídele al dueño uno nuevo.</Aviso>
        )
      }
      pie="¿No tienes cuenta? Pídesela al dueño del puesto."
    >
      <FormularioEntrar />
    </PantallaDeAcceso>
  );
}
