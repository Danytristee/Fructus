import type { Metadata } from "next";

import { Aviso } from "@/components/ui/Aviso";
import { FondoAurora } from "@/components/ui/FondoAurora";
import { Fruta } from "@/components/ui/Fruta";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar · Fructus" };

export default async function Login({ searchParams }: { searchParams: Promise<{ enlace?: string }> }) {
  const { enlace } = await searchParams;
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <FondoAurora />
      <header className="grid animate-subir justify-items-center gap-3 text-center">
        <div aria-hidden className="flex -space-x-3">
          <Fruta fruta="mango" tamano={56} />
          <Fruta fruta="platano" tamano={56} className="-translate-y-2" />
          <Fruta fruta="pina" tamano={56} />
        </div>
        <h1 className="text-[40px] leading-none font-extrabold tracking-tight">Fructus</h1>
        <p className="text-texto-suave">Tus ventas, deudas y stock, por voz.</p>
      </header>
      {enlace === "vencido" && (
        <Aviso titulo="Ese enlace ya no sirve">Los enlaces sirven una sola vez y por una hora. Pídele al dueño uno nuevo.</Aviso>
      )}
      <Tarjeta protagonista className="animate-subir [animation-delay:80ms]">
        <FormularioEntrar />
      </Tarjeta>
      <p className="animate-subir text-center text-texto-suave [animation-delay:160ms]">
        ¿No tienes cuenta? Pídesela al dueño del puesto.
      </p>
    </main>
  );
}
