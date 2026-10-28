"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { guardarClave, type EstadoClave } from "./acciones";

export function FormularioClave() {
  const [estado, enviar, enviando] = useActionState<EstadoClave, FormData>(guardarClave, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={enviar} noValidate className="grid gap-4">
      <Campo
        id="clave"
        name="clave"
        type={ver ? "text" : "password"}
        autoComplete="new-password"
        etiqueta="Tu clave nueva"
        error={estado.error}
        minLength={8}
        required
        fin={
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? "Ocultar la clave" : "Mostrar la clave"}
            aria-pressed={ver}
            className="grid size-12 place-items-center rounded-full text-texto-suave"
          >
            {ver ? <EyeOff aria-hidden className="size-6" /> : <Eye aria-hidden className="size-6" />}
          </button>
        }
      />
      <p className="-mt-2 text-texto-suave">8 letras o números como mínimo. Anótala donde no se pierda.</p>
      <Boton type="submit" cargando={enviando}>
        Guardar y entrar
      </Boton>
    </form>
  );
}
