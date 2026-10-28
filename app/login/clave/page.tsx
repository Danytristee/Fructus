import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FondoAurora } from "@/components/ui/FondoAurora";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioClave } from "./FormularioClave";

export const metadata: Metadata = { title: "Elige tu clave · Fructus" };

// Aquí llega quien abrió su enlace de invitación (ya tiene sesión) para elegir su clave.
export default async function ElegirClave() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?enlace=vencido");

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <FondoAurora />
      <header className="grid animate-subir gap-1 text-center">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Elige tu clave</h1>
        <p className="text-texto-suave">Con ella vas a entrar a Fructus desde tu celular.</p>
      </header>
      <Tarjeta protagonista className="animate-subir [animation-delay:80ms]">
        <FormularioClave />
      </Tarjeta>
    </main>
  );
}
