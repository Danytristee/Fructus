import { UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { iniciales, tonoDe } from "@/lib/operaciones-reglas";
import { FilaTarjeta } from "./FilaTarjeta";

type Props = {
  cliente: { id: number; nombre: string } | null;
  /** Cómo lo nombró la persona («don lucho»), si lo nombró. */
  dicho: string | null;
  falta: boolean;
  /** A mano (A8): todavía no se elige a nadie; se pide con borde del acento, no en rojo. */
  pendiente?: boolean;
  /** Lo que se lee en grande si no hay cliente ni nada dicho: «Sin cliente» (voz) o «¿Quién te pagó?» (a mano). */
  sinCliente?: string;
  /** Lo que se lee debajo cuando no se dijo ningún nombre: «Cliente de paso». */
  sinNombre: string;
  alTocar: () => void;
  /** Una insignia junto a lo de abajo, como «corregido» tras corregir hablando. */
  insignia?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

// El cliente de una tarjeta de voz (venta, abono): quién es, en grande, y tocable para elegir otro.
export function FilaCliente({ cliente, dicho, falta, pendiente, sinCliente = "Sin cliente", sinNombre, alTocar, insignia, style, className }: Props) {
  const texto = cliente
    ? // Lo que dijo, para reconocer al cliente por su apodo: «Luis Paredes» puede no sonarle a «don Lucho» (/formidable).
      dicho && !mismoNombre(dicho, cliente.nombre)
      ? `dijiste «${dicho}»`
      : undefined
    : dicho
      ? "Toca para elegir quién es"
      : sinNombre;
  return (
    <FilaTarjeta
      style={style}
      className={className}
      falta={falta}
      pendiente={pendiente}
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
      grande={cliente?.nombre ?? (dicho ? `¿${dicho}?` : sinCliente)}
      chico={
        insignia ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {texto}
            {insignia}
          </span>
        ) : (
          texto
        )
      }
    />
  );
}
