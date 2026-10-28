import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/servidor";

const TIPOS = ["invite", "recovery"] as const;
type Tipo = (typeof TIPOS)[number];
const esTipo = (valor: string | null): valor is Tipo => TIPOS.some((t) => t === valor);

// El enlace de invitación (scripts/invitar.mjs) llega aquí: se canjea por una sesión y se va a elegir la clave.
export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams;
  const tokenHash = parametros.get("token_hash");
  const tipo = parametros.get("type");

  if (tokenHash && esTipo(tipo)) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) redirect("/login/clave");
    console.error("confirmar: el enlace no sirvió", { codigo: error.code ?? error.name });
  }
  redirect("/login?enlace=vencido");
}
