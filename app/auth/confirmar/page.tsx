import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { PantallaDeAcceso } from "@/components/marco/PantallaDeAcceso";
import { canjearEnlace } from "./acciones";

export const metadata: Metadata = { title: "Tu acceso a Fructus", robots: { index: false, follow: false } };

// Aquí llega el enlace de invitación (pnpm cuentas:invitar). Esta página NO canjea el enlace: solo lo muestra con un
// botón. Así una vista previa (WhatsApp, un antivirus del correo) puede abrirla sin gastarlo.
export default async function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type: tipo } = await searchParams;
  if (!tokenHash || (tipo !== "invite" && tipo !== "recovery")) redirect("/login?enlace=vencido");

  return (
    <PantallaDeAcceso titulo="Ya casi entras a Fructus" subtitulo="Toca el botón para elegir la clave con la que vas a entrar desde tu celular.">
      <form action={canjearEnlace} className="grid gap-3">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={tipo} />
        <Boton type="submit">
          <KeyRound aria-hidden />
          Elegir mi clave
        </Boton>
        <p className="text-center text-texto-suave">Este enlace sirve una sola vez y por una hora.</p>
      </form>
    </PantallaDeAcceso>
  );
}
