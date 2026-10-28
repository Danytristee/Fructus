import { salir } from "@/app/login/acciones";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";

// Una cuenta que entró pero no tiene perfil activo (todavía no la activaron, o la desactivaron).
export function CuentaInactiva() {
  return (
    <div className="grid min-h-[70dvh] content-center gap-4">
      <Aviso titulo="Tu cuenta todavía no está activa">
        Pídele al dueño del puesto que te dé acceso en Ajustes. Cuando lo haga, vuelve a entrar.
      </Aviso>
      <form action={salir}>
        <Boton type="submit" variante="secundario" className="w-full">
          Salir
        </Boton>
      </form>
    </div>
  );
}
