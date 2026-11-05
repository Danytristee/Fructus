import { Receipt } from "lucide-react";

import { FilaOperacion } from "@/components/hoy/FilaOperacion";
import { Vacio } from "@/components/ui/Vacio";
import type { DiaOperaciones } from "@/lib/ficha-cliente-reglas";

type Props = { dias: DiaOperaciones[]; hayMas: boolean; tope: number };

// Lo que le vendiste y lo que te pagó, día por día, de lo más reciente a lo más viejo: su hoja del cuaderno.
export function HistorialCliente({ dias, hayMas, tope }: Props) {
  if (dias.length === 0) {
    return (
      <Vacio className="mt-6" icono={<Receipt />} titulo="Todavía no hay movimientos">
        Cuando le vendas o te pague, aparece aquí.
      </Vacio>
    );
  }
  return (
    <section aria-labelledby="movimientos" className="mt-6" data-testid="movimientos">
      <h2 id="movimientos" className="mb-2 text-xl font-extrabold">
        Sus movimientos
      </h2>
      {dias.map((d) => (
        <div key={d.dia} className="mb-3">
          <h3 className="mb-1.5 px-1 text-base font-bold text-texto-suave first-letter:uppercase">{d.etiqueta}</h3>
          <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
            {d.operaciones.map((op) => (
              <FilaOperacion key={op.clave} op={op} />
            ))}
          </ul>
        </div>
      ))}
      {hayMas && <p className="px-1 text-texto-suave">Se muestran los últimos {tope} movimientos.</p>}
    </section>
  );
}
