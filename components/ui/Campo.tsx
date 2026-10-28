import { cn } from "cn";

type Props = React.ComponentProps<"input"> & {
  etiqueta: string;
  /** El error de este campo, en lenguaje de puesto. Se anuncia y se lee junto al campo. */
  error?: string;
  /** Un botón al final del campo (por ejemplo, mostrar la clave). */
  fin?: React.ReactNode;
};

// Un campo de texto grande: etiqueta siempre visible arriba (nunca solo el placeholder), 56 px de alto y 18 px de letra.
export function Campo({ etiqueta, error, fin, id, className, ...props }: Props) {
  const idError = error ? `${id}-error` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="font-bold">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={idError}
          className={cn(
            "min-h-14 w-full rounded-control border-2 border-borde/50 bg-superficie px-4 text-lg text-texto outline-none",
            "transition-colors focus:border-acento aria-invalid:border-deuda",
            fin && "pr-16",
          )}
          {...props}
        />
        {fin && <div className="absolute inset-y-0 right-1 grid place-items-center">{fin}</div>}
      </div>
      {error && (
        <p id={idError} className="font-bold text-deuda">
          {error}
        </p>
      )}
    </div>
  );
}
