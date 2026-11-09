import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PantallaDeAcceso } from "@/components/marco/PantallaDeAcceso";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioClave } from "./FormularioClave";

export const metadata: Metadata = { title: "Elige tu clave · Fructus" };

// Aquí llega quien abrió su enlace de invitación (ya tiene sesión) para elegir su clave.
export default async function ElegirClave() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?enlace=vencido");

  return (
    <PantallaDeAcceso titulo="Elige tu clave" subtitulo="Con ella vas a entrar a Fructus desde tu celular.">
      <FormularioClave />
    </PantallaDeAcceso>
  );
}
