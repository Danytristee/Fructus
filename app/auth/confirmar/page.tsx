import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { FondoAurora } from "@/components/ui/FondoAurora";
import { Fruta } from "@/components/ui/Fruta";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { canjearEnlace } from "./acciones";

export const metadata: Metadata = { title: "Tu acceso a Fructus", robots: { index: false, follow: false } };

// Aquí llega el enlace de invitación (pnpm cuentas:invitar). Esta página NO canjea el enlace: solo lo muestra con un
// botón. Así una vista previa (WhatsApp, un antivirus del correo) puede abrirla sin gastarlo.
export default async function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type: tipo } = await searchParams;
  if (!tokenHash || (tipo !== "invite" && tipo !== "recovery")) redirect("/login?enlace=vencido");

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <FondoAurora />
      <header className="grid animate-subir justify-items-center gap-3 text-center">
        <div aria-hidden className="flex -space-x-3">
          <Fruta fruta="manzana" tamano={56} />
          <Fruta fruta="pera" tamano={56} className="-translate-y-2" />
          <Fruta fruta="uva" tamano={56} />
        </div>
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Ya casi entras a Fructus</h1>
        <p className="text-texto-suave">Toca el botón para elegir la clave con la que vas a entrar desde tu celular.</p>
      </header>
      <Tarjeta protagonista className="animate-subir [animation-delay:80ms]">
        <form action={canjearEnlace} className="grid gap-3">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={tipo} />
          <Boton type="submit">
            <KeyRound aria-hidden />
            Elegir mi clave
          </Boton>
          <p className="text-center text-texto-suave">Este enlace sirve una sola vez y por una hora.</p>
        </form>
      </Tarjeta>
    </main>
  );
}
