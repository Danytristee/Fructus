import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";

const TONO = { deuda: "bg-deuda-fondo text-deuda", sol: "bg-sol/12 text-sol" } as const;

type Props = {
  icono: React.ReactNode;
  /** El color del ícono: `deuda` para lo que urge, `sol` para lo que se pide. El texto siempre dice de qué se trata. */
  tono?: keyof typeof TONO;
  titulo: string;
  /** Para qué sirve o qué falta, en pocas palabras. */
  detalle?: string;
} & ({ href: string } | { alTocar: () => void; cargando?: boolean });

// Un renglón que se toca: un aviso corto que lleva a otra pantalla (`href`) o abre una hoja (`alTocar`). Va dentro de una lista
// con `vidrio`, un renglón por cosa. Deja 4 px arriba y abajo sin tocar: entre dos renglones seguidos quedan los 8 px que pide
// la regla del celular, sin partir la lista en dos tarjetas.
export function Renglon(props: Props) {
  const { icono, tono = "sol", titulo, detalle } = props;
  const cargando = "alTocar" in props && props.cargando === true;
  const clase =
    "my-1 grid min-h-12 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-1.5 text-left transition-colors duration-150 ease-out active:bg-acento/6";
  const dentro = (
    <>
      <span className={cn("grid size-10 place-items-center rounded-[14px] [&_svg]:size-5", TONO[tono])}>{icono}</span>
      <span className="grid min-w-0">
        <span className="leading-tight font-extrabold first-letter:uppercase">{titulo}</span>
        {detalle && <span className="leading-snug text-texto-suave">{detalle}</span>}
      </span>
      {cargando ? (
        <span aria-hidden className="size-6 animate-girar rounded-full border-[3px] border-texto-suave border-r-transparent" />
      ) : (
        <ChevronRight aria-hidden className="size-6 text-texto-suave" />
      )}
    </>
  );
  if ("href" in props) {
    return (
      <Link href={props.href} className={clase}>
        {dentro}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.alTocar} disabled={cargando} aria-busy={cargando || undefined} className={clase}>
      {dentro}
    </button>
  );
}
