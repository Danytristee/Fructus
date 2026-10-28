import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Button } from "@/components/shadcn/button";

// Una función, una pieza: todo «Confirmar», «Guardar» o «Descartar» de la app sale de aquí.
const variantes = cva(
  "h-auto rounded-full font-extrabold whitespace-normal transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-100 [&_svg:not([class*='size-'])]:size-6",
  {
    variants: {
      variante: {
        principal: "min-h-[68px] w-full bg-acento px-6 text-[22px] text-sobre-acento hover:bg-acento",
        secundario: "vidrio min-h-14 px-5 text-lg text-texto hover:bg-vidrio",
        texto: "min-h-12 bg-transparent px-5 text-base text-texto-suave shadow-none hover:bg-transparent",
      },
    },
    defaultVariants: { variante: "principal" },
  },
);

type Props = Omit<React.ComponentProps<"button">, "children"> &
  VariantProps<typeof variantes> & {
    children: React.ReactNode;
    /** Mientras la base no responde: muestra el giro y no acepta un segundo toque. */
    cargando?: boolean;
  };

export function Boton({ variante, cargando = false, disabled, className, children, ...props }: Props) {
  return (
    <Button
      // «ghost» no trae fondo propio: así el vidrio de la variante secundaria no compite con bg-primary.
      variant={variante === "principal" || variante == null ? "default" : "ghost"}
      className={cn(variantes({ variante }), "relative grid place-items-center", className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      <span className={cn("col-start-1 row-start-1 inline-flex items-center gap-2", cargando && "invisible")}>{children}</span>
      {cargando && (
        <span
          aria-hidden
          className="col-start-1 row-start-1 size-7 animate-girar rounded-full border-[3.5px] border-current border-r-transparent"
        />
      )}
    </Button>
  );
}
