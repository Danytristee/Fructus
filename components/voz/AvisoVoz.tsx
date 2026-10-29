import { RotateCcw, TriangleAlert, X } from "lucide-react";

type Props = {
  mensaje: string;
  /** Hay un audio guardado en el celular: se ofrece reintentarlo. */
  pendiente: boolean;
  alReintentar: () => void;
  alCerrar: () => void;
};

// Lo que pasó con el último audio, encima del orbe: qué falló, en lenguaje de puesto, y qué hacer (CLAUDE.md, principio 8).
export function AvisoVoz({ mensaje, pendiente, alReintentar, alCerrar }: Props) {
  return (
    <div role="alert" className="vidrio pointer-events-auto mx-4 grid max-w-sm animate-subir gap-2 rounded-tarjeta p-3 pl-4">
      <p className="flex items-start gap-2 font-bold">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-deuda" />
        <span className="flex-1">{mensaje}</span>
        <button type="button" onClick={alCerrar} className="-mt-2 -mr-1 grid size-12 shrink-0 place-items-center rounded-full text-texto-suave">
          <X aria-hidden className="size-5" />
          <span className="sr-only">{pendiente ? "Borrar el audio guardado" : "Cerrar el aviso"}</span>
        </button>
      </p>
      {pendiente && (
        <button
          type="button"
          onClick={alReintentar}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-acento px-5 font-extrabold text-sobre-acento transition-transform duration-150 active:scale-[0.97]"
        >
          <RotateCcw aria-hidden className="size-5" />
          Reintentar
        </button>
      )}
    </div>
  );
}
