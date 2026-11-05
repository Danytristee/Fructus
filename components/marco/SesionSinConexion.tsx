import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";

// La base no respondió al preguntar quién eres (sin señal o muy lenta). No es una cuenta sin acceso: no se le dice a
// nadie que pida permiso por una caída de red. Lo dictado no se pierde: aquí todavía no se dictó nada.
export function SesionSinConexion() {
  return (
    <Aviso titulo="No pudimos conectar con tu cuaderno" accion={<BotonReintentar />}>
      Revisa tu señal y vuelve a intentar. Lo que ya guardaste está a salvo.
    </Aviso>
  );
}
