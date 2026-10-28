import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "cn";

const tipos = {
  error: { clase: "bg-deuda-fondo text-deuda", Icono: CircleAlert, rol: "alert" },
  info: { clase: "bg-acento/10 text-acento-texto", Icono: Info, rol: "status" },
  exito: { clase: "bg-exito-fondo text-exito", Icono: CircleCheck, rol: "status" },
} as const;

type Props = {
  tipo?: keyof typeof tipos;
  /** Qué pasó, en una frase de puesto: «No pudimos guardar la venta». */
  titulo: string;
  /** Qué hacer ahora. Entre las dos, tres líneas como mucho. */
  children?: React.ReactNode;
  /** Un botón para resolverlo («Reintentar»), si existe. */
  accion?: React.ReactNode;
  className?: string;
};

// Un mensaje en la pantalla: error, información o éxito. Siempre con icono y texto, nunca solo color.
export function Aviso({ tipo = "error", titulo, children, accion, className }: Props) {
  const { clase, Icono, rol } = tipos[tipo];
  return (
    <div role={rol} className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-tarjeta p-4", clase, className)}>
      <Icono aria-hidden className="mt-0.5 size-6" strokeWidth={2.4} />
      <div className="grid gap-0.5">
        <p className="font-extrabold">{titulo}</p>
        {children && <div className="text-texto">{children}</div>}
      </div>
      {accion && <div className="col-span-2">{accion}</div>}
    </div>
  );
}
