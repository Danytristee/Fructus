import { Insignia } from "@/components/ui/Insignia";

// «sugerido»: el monto no se dijo, se puso el último (principio 2). Un barrido una vez para que se note sin gritar.
export function InsigniaSugerido() {
  return (
    <Insignia tipo="sugerido" className="relative overflow-hidden">
      sugerido
      <span aria-hidden className="absolute inset-0 animate-barrido bg-linear-[100deg] from-transparent from-30% via-superficie/70 to-transparent to-70%" />
    </Insignia>
  );
}
