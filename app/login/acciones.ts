"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoEntrar = {
  correo: string;
  error?: string;
  errores?: { correo?: string; clave?: string };
};

const datosEntrar = z.object({
  correo: z.email("Escribe un correo válido, por ejemplo: nombre@gmail.com."),
  clave: z.string().min(1, "Escribe tu clave."),
});

export async function entrar(_anterior: EstadoEntrar, formulario: FormData): Promise<EstadoEntrar> {
  const correo = String(formulario.get("correo") ?? "").trim();
  const leido = datosEntrar.safeParse({ correo, clave: formulario.get("clave") ?? "" });
  if (!leido.success) {
    const campos = z.flattenError(leido.error).fieldErrors;
    return { correo, errores: { correo: campos.correo?.[0], clave: campos.clave?.[0] } };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: leido.data.correo, password: leido.data.clave });

  if (error) {
    // Nunca se registra el correo: solo el código (CLAUDE.md, «Logs con ids»).
    if (error.code === "invalid_credentials") {
      return { correo, error: "El correo o la clave no coinciden. Revísalos e inténtalo otra vez." };
    }
    console.error("entrar: Supabase no aceptó el ingreso", { codigo: error.code ?? error.name, estado: error.status });
    return { correo, error: "No pudimos conectar. Revisa tu señal e inténtalo otra vez." };
  }

  redirect("/");
}

export async function salir() {
  const supabase = await crearClienteServidor();
  // Solo este dispositivo: si el dueño sale en la computadora, sigue con sesión en su celular.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.error("salir: no se pudo cerrar la sesión en Supabase", { codigo: error.code ?? error.name });
  redirect("/login");
}
