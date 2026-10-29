"use server";

import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";

const TIPOS = ["invite", "recovery"] as const;
type Tipo = (typeof TIPOS)[number];
const esTipo = (valor: unknown): valor is Tipo => TIPOS.some((t) => t === valor);

// El enlace se canjea aquí, recién cuando una persona toca «Elegir mi clave». Abrir la página no lo gasta: la vista previa
// de WhatsApp abre el enlace sola, y si el canje fuera al abrir, le gastaba el enlace a la persona (ADR-0009, 2026-10-28).
export async function canjearEnlace(formulario: FormData) {
  const tokenHash = formulario.get("token_hash");
  const tipo = formulario.get("type");
  if (typeof tokenHash === "string" && tokenHash && esTipo(tipo)) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) redirect("/login/clave");
    console.error("confirmar: el enlace no sirvió", { codigo: error.code ?? error.name });
  }
  redirect("/login?enlace=vencido");
}
