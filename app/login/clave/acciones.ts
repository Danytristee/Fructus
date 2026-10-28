"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoClave = { error?: string };

const nuevaClave = z.string().min(8, "Usa 8 letras o números como mínimo.");

export async function guardarClave(_anterior: EstadoClave, formulario: FormData): Promise<EstadoClave> {
  const leido = nuevaClave.safeParse(formulario.get("clave") ?? "");
  if (!leido.success) return { error: leido.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: leido.data });
  if (error) {
    if (error.code === "weak_password") return { error: "Esa clave es muy fácil de adivinar. Prueba con otra más larga." };
    if (error.code === "same_password") return { error: "Esa ya es tu clave. Elige una distinta." };
    console.error("clave: Supabase no la guardó", { codigo: error.code ?? error.name });
    return { error: "No pudimos guardar tu clave. Revisa tu señal e inténtalo otra vez." };
  }
  redirect("/");
}
