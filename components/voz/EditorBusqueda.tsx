"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import type { Opcion } from "@/app/(app)/acciones-voz";

type Props = {
  etiqueta: string;
  /** Lo que se dijo: arranca escrito, para que la búsqueda ya muestre lo más parecido. */
  inicial: string;
  /** Las opciones que trajo la voz (las 3 más parecidas), mientras no se escriba otra cosa. */
  opciones: Opcion[];
  buscar: (q: string) => Promise<Opcion[] | null>;
  alElegir: (opcion: Opcion) => void;
  icono: (opcion: Opcion) => React.ReactNode;
  /** Qué decir si no hay nada parecido: «No encuentro a nadie así…». */
  sinResultados: string;
  /** Una salida que no es de la lista, por ejemplo «Cliente de paso». */
  extra?: React.ReactNode;
};

// Elegir quién o qué fue: un buscador grande y las opciones como filas de 56 px. Busca mientras se escribe.
export function EditorBusqueda({ etiqueta, inicial, opciones, buscar, alElegir, icono, sinResultados, extra }: Props) {
  const [q, setQ] = useState(inicial);
  const [lista, setLista] = useState<Opcion[]>(opciones);
  const [fallo, setFallo] = useState(false);
  // «No encuentro a nadie» solo después de buscar, no mientras la primera búsqueda viaja.
  const [buscado, setBuscado] = useState(opciones.length > 0);
  const espera = useRef(0);
  const vuelta = useRef(0);

  function escribir(texto: string) {
    setQ(texto);
    pedir(texto);
  }

  function pedir(texto: string) {
    window.clearTimeout(espera.current);
    const pedido = ++vuelta.current;
    espera.current = window.setTimeout(async () => {
      const r = await buscar(texto).catch(() => null);
      if (pedido !== vuelta.current) return; // llegó tarde: ya se escribió otra cosa
      setFallo(r === null);
      setBuscado(true);
      if (r) setLista(r);
    }, 250);
  }

  useEffect(() => {
    // Sin opciones de la voz (se toca algo ya elegido para cambiarlo): se busca lo que está escrito.
    if (opciones.length === 0 && inicial.trim()) pedir(inicial);
    return () => window.clearTimeout(espera.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir el editor
  }, []);

  return (
    <div className="grid gap-3">
      <label className="flex min-h-14 items-center gap-3 rounded-full bg-superficie px-4">
        <Search aria-hidden className="size-5 text-texto-suave" />
        <span className="sr-only">{etiqueta}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => escribir(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          placeholder={etiqueta}
          enterKeyHint="search"
          className="min-h-12 w-full bg-transparent text-lg outline-none placeholder:text-texto-suave"
        />
      </label>
      {fallo && <p className="font-bold text-deuda">No pude buscar. Revisa tu señal e inténtalo otra vez.</p>}
      <ul className="grid gap-2">
        {lista.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => alElegir(o)}
              className="grid min-h-14 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-[20px] bg-superficie px-3.5 py-2 text-left transition-transform duration-150 active:scale-[0.98]"
            >
              {icono(o)}
              <span className="grid">
                <span className="text-lg font-extrabold">{o.nombre}</span>
                {o.detalle && <span className="text-texto-suave">{o.detalle}</span>}
              </span>
            </button>
          </li>
        ))}
        {lista.length === 0 && buscado && !fallo && <li className="px-1 text-texto-suave">{sinResultados}</li>}
      </ul>
      {extra}
    </div>
  );
}
