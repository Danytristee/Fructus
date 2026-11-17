import { Contactar } from "@/components/ui/Contactar";

type Props = {
  telefono: string | null;
  /** Lo que se le escribe al abrir WhatsApp (`mensajeAlCliente`): si debe, el recordatorio con el monto. */
  mensaje: string;
  documento: string | null;
  direccion: string | null;
  notas: string | null;
  /** «Editar», solo para quien puede (dueño y administrador). Con él, la sección sale aunque no haya datos. */
  editar?: React.ReactNode;
};

// Cómo hablarle (escribirle por WhatsApp para cobrar o llamarlo, a un toque) y lo que se sabe del cliente además de sus cuentas. Solo
// salen los datos que hay: nada de filas con «—».
export function DatosCliente({ telefono, mensaje, documento, direccion, notas, editar }: Props) {
  const filas: { clave: string; etiqueta: string; valor: React.ReactNode }[] = [];
  if (telefono) filas.push({ clave: "telefono", etiqueta: "Teléfono", valor: telefono });
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
      <Contactar telefono={telefono} mensaje={mensaje} />
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
