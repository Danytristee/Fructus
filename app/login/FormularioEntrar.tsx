"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { entrar, type EstadoEntrar } from "./acciones";

export function FormularioEntrar() {
  const [estado, enviar, enviando] = useActionState<EstadoEntrar, FormData>(entrar, { correo: "" });
  const [verClave, setVerClave] = useState(false);

  return (
    <form action={enviar} noValidate className="grid gap-4">
      {estado.error && <Aviso titulo={estado.error} />}
      <Campo
        id="correo"
        name="correo"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        etiqueta="Correo"
        defaultValue={estado.correo}
        error={estado.errores?.correo}
        required
      />
      <Campo
        id="clave"
        name="clave"
        type={verClave ? "text" : "password"}
        autoComplete="current-password"
        etiqueta="Clave"
        error={estado.errores?.clave}
        required
        fin={
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar la clave" : "Mostrar la clave"}
            aria-pressed={verClave}
            className="grid size-12 place-items-center rounded-full text-texto-suave"
          >
            {verClave ? <EyeOff aria-hidden className="size-6" /> : <Eye aria-hidden className="size-6" />}
          </button>
        }
      />
      <Boton type="submit" cargando={enviando} className="mt-2">
        Entrar
      </Boton>
    </form>
  );
}
