"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";

import type { ProveedorEditable } from "./HojaProveedor";

// La hoja llega en diferido (no pesa en la primera carga) y se pide por detrás apenas la pantalla queda lista.
const cargarHoja = () => import("./HojaProveedor").then((m) => m.HojaProveedor);
const HojaProveedor = dynamic(cargarHoja, { ssr: false });

type Props = {
  /** null: «Nuevo proveedor», un botón redondo junto al buscador. Con datos: «Editar», en la ficha. */
  proveedor: ProveedorEditable | null;
};

export function BotonProveedor({ proveedor }: Props) {
  const [abierta, setAbierta] = useState(false);
  // Después de abrirla una vez se queda montada (cerrada), para que su salida se anime.
  const [montada, setMontada] = useState(false);

  useEffect(() => {
    void cargarHoja();
  }, []);

  function abrir() {
    setMontada(true);
    setAbierta(true);
  }

  return (
    <>
      {proveedor ? (
        <button type="button" onClick={abrir} className="flex min-h-12 items-center gap-2 rounded-full px-3 font-extrabold text-acento-texto">
          <Pencil aria-hidden className="size-5" />
          Editar
        </button>
      ) : (
        <button type="button" onClick={abrir} aria-label="Nuevo proveedor" className="vidrio grid size-14 shrink-0 place-items-center rounded-full text-acento-texto">
          <Plus aria-hidden className="size-6" />
        </button>
      )}
      {montada && <HojaProveedor abierta={abierta} alCerrar={() => setAbierta(false)} proveedor={proveedor} />}
    </>
  );
}
