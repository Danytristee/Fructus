import { Sello } from "@/components/ui/Sello";

type Props = { titulo: string; children?: React.ReactNode };

// Lo que ve la persona cuando la base respondió que se guardó: el sello, qué se guardó y, si importa, cómo quedó.
export function Guardado({ titulo, children }: Props) {
  return (
    <div role="status" className="grid justify-items-center gap-1 py-5 text-center">
      <Sello />
      <p className="mt-3 text-2xl font-extrabold">{titulo}</p>
      {children && <p className="text-lg text-texto-suave">{children}</p>}
    </div>
  );
}
