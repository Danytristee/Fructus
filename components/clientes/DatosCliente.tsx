import { Phone } from "lucide-react";

import { enlaceDeLlamada } from "@/lib/ficha-cliente-reglas";

type Props = {
  telefono: string | null;
  documento: string | null;
  direccion: string | null;
  notas: string | null;
  /** «Editar», solo para quien puede (dueño y administrador). Con él, la sección sale aunque no haya datos. */
  editar?: React.ReactNode;
};

// Lo que se sabe del cliente además de sus cuentas. Solo salen los datos que hay: nada de filas con «—».
export function DatosCliente({ telefono, documento, direccion, notas, editar }: Props) {
  const llamar = enlaceDeLlamada(telefono);
  const filas: { clave: string; etiqueta: string; valor: React.ReactNode }[] = [];
  if (telefono) {
    filas.push({
      clave: "telefono",
      etiqueta: "Teléfono",
      valor: llamar ? (
        <a href={llamar} className="flex min-h-12 items-center gap-2 font-extrabold text-acento-texto">
          <Phone aria-hidden className="size-5" />
          {telefono}
        </a>
      ) : (
        telefono
      ),
    });
  }
  if (documento) filas.push({ clave: "documento", etiqueta: "Documento", valor: documento });
  if (direccion) filas.push({ clave: "direccion", etiqueta: "Dirección", valor: direccion });
  if (notas) filas.push({ clave: "notas", etiqueta: "Notas", valor: notas });
  if (filas.length === 0 && !editar) return null;

  return (
    <section aria-labelledby="datos-cliente" className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="datos-cliente" className="text-xl font-extrabold">
          Sus datos
        </h2>
        {editar}
      </div>
      {filas.length === 0 && <p className="vidrio rounded-tarjeta px-4 py-3 text-texto-suave">Todavía no tiene teléfono ni documento.</p>}
      <dl className="vidrio divide-y divide-border rounded-tarjeta px-4 empty:hidden">
        {filas.map((f) => (
          <div key={f.clave} className="grid min-h-14 grid-cols-[7rem_1fr] items-center gap-3 py-2">
            <dt className="text-texto-suave">{f.etiqueta}</dt>
            <dd className="min-w-0 font-bold break-words">{f.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
