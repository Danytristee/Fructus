import { cn } from "cn";
import { Button } from "@/components/shadcn/button";
import { variantesDeBoton } from "./Boton";

type Props = Omit<React.ComponentProps<"a">, "children"> & {
  variante?: "principal" | "secundario" | "flotante" | "texto";
  children: React.ReactNode;
};

// Un enlace que se ve y se toca como un botón (abrir un PDF, abrir WhatsApp): la misma pieza que `Boton`, con la etiqueta <a>.
// Los enlaces que salen de la app abren en otra pestaña y sin darle a la otra página acceso a esta (`noopener`).
export function BotonEnlace({ variante = "secundario", className, children, target, rel, ...props }: Props) {
  return (
    <Button
      asChild
      variant={variante === "principal" || variante === "flotante" ? "default" : "ghost"}
      className={cn(variantesDeBoton({ variante }), "relative grid place-items-center", className)}
    >
      <a target={target} rel={target === "_blank" ? "noopener noreferrer" : rel} {...props}>
        <span className="inline-flex items-center gap-2">{children}</span>
      </a>
    </Button>
  );
}
