import { CloudUpload } from "lucide-react";

import { nombreOperacion } from "@/lib/voz/nombre-operacion-reglas";

// Lo que ve la persona cuando confirmó sin señal (ADR-0017): quedó en el celular, todavía no en la base. No es el sello
// verde de «guardado» (nada optimista en dinero ni en stock): es un icono quieto que dice qué pasa y qué va a pasar.
export function EnCola({ tipo }: { tipo: string }) {
  const { uno } = nombreOperacion(tipo);
  return (
    <div role="status" className="grid animate-pieza justify-items-center gap-1 py-5 text-center">
      <span aria-hidden className="grid size-24 place-items-center rounded-full bg-profundo text-lima">
        <CloudUpload className="size-11" strokeWidth={2.2} />
      </span>
      <p className="mt-3 text-2xl font-extrabold">Quedó en el celular</p>
      <p className="text-lg text-texto-suave">
        No hay señal. Guardé {uno} aquí y se envía cuando vuelva, sin que hagas nada.
      </p>
    </div>
  );
}
