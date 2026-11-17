import { Contactar } from "@/components/ui/Contactar";

type Props = {
  contacto: string | null;
  telefono: string | null;
  ruc: string | null;
  origen: string | null;
  direccion: string | null;
  notas: string | null;
  /** Lo que se le escribe al abrir WhatsApp: la persona lo lee, lo cambia si quiere y lo manda ella. */
  mensaje: string;
  editar?: React.ReactNode;
};

// Cómo hablarle (llamar o escribirle por WhatsApp, a un toque) y lo que se sabe de él. Solo salen los datos que hay: nada de filas con «—».
// WhatsApp se abre con un enlace: no se usa su API, que cobra por los mensajes (CLAUDE.md, «No se usa»).
export function DatosProveedor({ contacto, telefono, ruc, origen, direccion, notas, mensaje, editar }: Props) {
  const filas = [
    contacto && { clave: "contacto", etiqueta: "Contacto", valor: contacto },
    telefono && { clave: "telefono", etiqueta: "Teléfono", valor: telefono },
    ruc && { clave: "ruc", etiqueta: "RUC", valor: ruc },
    origen && { clave: "origen", etiqueta: "Trae de", valor: origen },
    direccion && { clave: "direccion", etiqueta: "Dirección", valor: direccion },
    notas && { clave: "notas", etiqueta: "Notas", valor: notas },
  ].filter((f): f is { clave: string; etiqueta: string; valor: string } => Boolean(f));
  if (filas.length === 0 && !editar) return null;

  return (
    <section aria-labelledby="datos-proveedor" className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="datos-proveedor" className="text-xl font-extrabold">
          Sus datos
        </h2>
        {editar}
      </div>
      <Contactar telefono={telefono} mensaje={mensaje} />
      {filas.length === 0 && <p className="vidrio rounded-tarjeta px-4 py-3 text-texto-suave">Todavía no tiene teléfono ni RUC.</p>}
      <dl className="vidrio divide-y divide-border rounded-tarjeta px-4 empty:hidden">
        {filas.map((f) => (
          <div key={f.clave} className="grid min-h-14 grid-cols-[6.5rem_1fr] items-center gap-3 py-2">
            <dt className="text-texto-suave">{f.etiqueta}</dt>
            <dd className="min-w-0 font-bold break-words">{f.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
