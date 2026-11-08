import { cn } from "cn";

type Props = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

// El pie de una hoja: queda pegado abajo mientras lo de arriba se desliza, para que la acción de salir o de confirmar siempre se alcance
// (regla 1 del celular), aunque el contenido crezca (un rechazo con un motivo largo, un nombre largo). El borde inferior negativo iguala
// el margen de la hoja: sin deslizar, el pie queda donde estaría sin pegarse y no tapa lo de arriba. Lo usan las tarjetas de voz
// (`PieConfirmar`) y el detalle de la venta.
export function PieFijo({ children, className, style }: Props) {
  return (
    <div
      className={cn(
        "sticky -bottom-[calc(16px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-1 -mb-[calc(16px+env(safe-area-inset-bottom))] grid bg-fondo px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-12px_16px_-12px_rgb(var(--sombra-color)/0.25)] md:-bottom-5 md:-mb-5",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
