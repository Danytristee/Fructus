import { cn } from "cn";

type Props = {
  /** Un icono de lucide o una Fruta, grande y centrado. */
  icono: React.ReactNode;
  /** Qué falta: «Todavía no vendiste hoy». */
  titulo: string;
  /** Qué hacer: «Toca el botón y di la venta». */
  children: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
};

// El estado vacío de una pantalla o sección: dice qué falta y qué hacer, nunca solo «No hay datos».
export function Vacio({ icono, titulo, children, accion, className }: Props) {
  return (
    <div className={cn("vidrio grid justify-items-center gap-2 rounded-tarjeta px-5 py-8 text-center", className)}>
      <span aria-hidden className="mb-1 grid size-16 place-items-center rounded-full bg-lima-suave text-acento-texto [&_svg]:size-8">
        {icono}
      </span>
      <p className="text-xl font-extrabold">{titulo}</p>
      <div className="max-w-[32ch] text-texto-suave">{children}</div>
      {accion && <div className="mt-2 w-full">{accion}</div>}
    </div>
  );
}
