import { UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { FilaTarjeta } from "./FilaTarjeta";

type Props = {
  cliente: { id: number; nombre: string } | null;
  /** Cómo lo nombró la persona («don lucho»), si lo nombró. */
  dicho: string | null;
  falta: boolean;
  /** Lo que se lee debajo cuando no se dijo ningún nombre: «Cliente de paso». */
  sinNombre: string;
  alTocar: () => void;
  style?: React.CSSProperties;
  className?: string;
};

const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

// El cliente de una tarjeta de voz (venta, abono): quién es, en grande, y tocable para elegir otro.
export function FilaCliente({ cliente, dicho, falta, sinNombre, alTocar, style, className }: Props) {
  return (
    <FilaTarjeta
      style={style}
      className={className}
      falta={falta}
      onClick={alTocar}
      icono={
        cliente ? (
          <Avatar iniciales={iniciales(cliente.nombre)} tono={tonoDe(cliente.id)} />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-texto/8 text-texto-suave">
            <UserRound aria-hidden />
          </span>
        )
      }
      grande={cliente?.nombre ?? (dicho ? `¿${dicho}?` : "Sin cliente")}
      chico={
        cliente
          ? // Lo que dijo, para reconocer al cliente por su apodo: «Luis Paredes» puede no sonarle a «don Lucho» (/formidable).
            dicho && !mismoNombre(dicho, cliente.nombre)
            ? `dijiste «${dicho}»`
            : undefined
          : dicho
            ? "Toca para elegir quién es"
            : sinNombre
      }
    />
  );
}
