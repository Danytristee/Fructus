import { cn } from "cn";

type Props = React.ComponentProps<"div"> & {
  /** La tarjeta principal de la pantalla: más aire y esquinas más redondas. Una por pantalla. */
  protagonista?: boolean;
};

export function Tarjeta({ protagonista = false, className, ...props }: Props) {
  return (
    <div
      className={cn("vidrio", protagonista ? "rounded-protagonista p-[18px]" : "rounded-tarjeta p-4", className)}
      {...props}
    />
  );
}
