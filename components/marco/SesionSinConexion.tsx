import { Aviso } from "@/components/ui/Aviso";
import { BotonReintentar } from "@/components/ui/BotonReintentar";

// La base no respondió al preguntar quién eres (sin señal o muy lenta). No es una cuenta sin acceso: no se le dice a
// nadie que pida permiso por una caída de red. «Lo que ya guardaste está a salvo» es cierto: aquí todavía no se guardó
// nada nuevo. Sin «cuaderno» en el título: en la prueba ciega (/formidable 2026-11-05) no supieron si era la lista de
// clientes o toda la app. El botón ocupa el ancho: con una caja en la otra mano, el pulgar lo alcanza sin apuntar.
export function SesionSinConexion() {
  return (
    <Aviso titulo="No pudimos conectar" accion={<BotonReintentar className="w-full" />}>
      Revisa tu señal y vuelve a intentar. Lo que ya guardaste está a salvo.
    </Aviso>
  );
}
