"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Esperar = <T>(trabajo: Promise<T>, texto?: string) => Promise<T>;

const Contexto = createContext<Esperar | null>(null);

// El único indicador de guardado a pantalla completa (CLAUDE.md): se monta una vez en el layout.
// Mientras la base no responde, tapa la pantalla: nadie toca Confirmar dos veces ni cambia de pantalla a medias.
// Aparece después de 150 ms para que un guardado rápido no parpadee.
export function EsperaProveedor({ children }: { children: React.ReactNode }) {
  const [texto, setTexto] = useState<string | null>(null);
  const pendientes = useRef(0);

  const esperar = useCallback<Esperar>(async (trabajo, nuevoTexto = "Guardando…") => {
    pendientes.current += 1;
    const mostrar = window.setTimeout(() => setTexto(nuevoTexto), 150);
    try {
      return await trabajo;
    } finally {
      window.clearTimeout(mostrar);
      pendientes.current -= 1;
      if (pendientes.current === 0) setTexto(null);
    }
  }, []);

  return (
    <Contexto.Provider value={esperar}>
      {children}
      {texto && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[60] grid animate-velo-aparece place-items-center bg-velo backdrop-blur-[2px]"
        >
          <div className="vidrio grid animate-subir justify-items-center gap-4 rounded-protagonista px-10 py-8">
            <span aria-hidden className="orbe relative grid size-16 place-items-center rounded-full animate-orbe">
              <span className="size-8 animate-girar rounded-full border-4 border-sobre-orbe border-r-transparent" />
            </span>
            <p className="text-lg font-extrabold">{texto}</p>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}

/** Envuelve un guardado: `await esperar(registrarVenta(...))`. */
export function useEspera(): Esperar {
  const esperar = useContext(Contexto);
  if (!esperar) throw new Error("useEspera necesita <EsperaProveedor> en el layout.");
  return esperar;
}
