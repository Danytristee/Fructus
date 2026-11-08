import { Info, TriangleAlert, X } from "lucide-react";

type Props = {
  mensaje: string;
  /** «error»: algo falló (Reintentar). «info»: algo que se puede deshacer. */
  tono: "error" | "info";
  /** La acción que arregla o deshace: Reintentar, Deshacer. */
  accion?: { etiqueta: string; icono: React.ReactNode; alTocar: () => void };
  /** Lo que lee el lector de pantalla en la X. */
  cerrar: { etiqueta: string; alTocar: () => void };
};

// Lo que pasó con la voz, encima del orbe: qué pasó, en lenguaje de puesto, y qué hacer (CLAUDE.md, principio 8 y ley 7).
export function AvisoVoz({ mensaje, tono, accion, cerrar }: Props) {
  const Icono = tono === "error" ? TriangleAlert : Info;
  return (
    <div role={tono === "error" ? "alert" : "status"} className="vidrio-desenfocado pointer-events-auto mx-4 grid max-w-sm animate-subir gap-2 rounded-tarjeta p-3 pl-4">
      <p className="flex items-start gap-2 font-bold">
        <Icono aria-hidden className={tono === "error" ? "mt-0.5 size-5 shrink-0 text-deuda" : "mt-0.5 size-5 shrink-0 text-acento-texto"} />
        <span className="flex-1">{mensaje}</span>
        <button type="button" onClick={cerrar.alTocar} className="-mt-2 -mr-1 grid size-12 shrink-0 place-items-center rounded-full text-texto-suave">
          <X aria-hidden className="size-5" />
          <span className="sr-only">{cerrar.etiqueta}</span>
        </button>
      </p>
      {accion && (
        <button
          type="button"
          onClick={accion.alTocar}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-acento px-5 font-extrabold text-sobre-acento transition-transform duration-150 active:scale-[0.97]"
        >
          {accion.icono}
          {accion.etiqueta}
        </button>
      )}
    </div>
  );
}
