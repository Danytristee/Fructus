import type { Metadata } from "next";
import { Apple, Users } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { SesionSinConexion } from "@/components/marco/SesionSinConexion";
import { Aviso } from "@/components/ui/Aviso";
import { Avatar } from "@/components/ui/Avatar";
import { BuscadorCatalogo } from "@/components/ui/BuscadorCatalogo";
import { nombreDelRol } from "@/lib/permisos-reglas";
import { iniciales } from "@/lib/operaciones-reglas";
import { exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ajustes · Fructus" };

// El catálogo del puesto y el equipo. Por ahora se lee; editar precios y dar acceso desde aquí llega en A12.
export default async function Ajustes() {
  // La guarda va en el servidor: esconder el enlace del menú no basta, alguien puede escribir /ajustes.
  const { supabase, permisos } = await exigirSesion();
  if (!permisos) {
    return (
      <>
        <Encabezado titulo="Ajustes" />
        <SesionSinConexion />
      </>
    );
  }
  if (!permisos.ajustes) {
    return (
      <>
        <Encabezado titulo="Ajustes" />
        <Aviso titulo="Ajustes es solo para el dueño o el administrador">Si necesitas cambiar un precio o una fruta, pídeselo al dueño.</Aviso>
      </>
    );
  }
  const [productos, equipo] = await Promise.all([
    supabase.from("productos").select("id, nombre, variedad, precio_referencia, alias").eq("activo", true).order("nombre").order("variedad"),
    supabase.from("perfiles").select("id, nombre, rol, activo").order("nombre"),
  ]);
  return (
    <>
      <Encabezado titulo="Ajustes" subtitulo="Tu catálogo y tu equipo" />
      {/* En escritorio (ADR-0015): el catálogo a la izquierda y el equipo al lado. */}
      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <section aria-labelledby="catalogo" className="animate-subir lg:col-span-7">
        <h2 id="catalogo" className="mb-2.5 flex items-center gap-2 text-xl font-extrabold">
          <Apple aria-hidden className="size-5 text-acento-texto" /> Tus frutas
        </h2>
        <BuscadorCatalogo
          productos={(productos.data ?? []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            variedad: p.variedad,
            precio: p.precio_referencia === null ? null : Number(p.precio_referencia),
            alias: p.alias ?? [],
          }))}
        />
      </section>
      <section aria-labelledby="equipo" className="mt-6 animate-subir [animation-delay:120ms] lg:col-span-5 lg:mt-0">
        <h2 id="equipo" className="mb-2.5 flex items-center gap-2 text-xl font-extrabold">
          <Users aria-hidden className="size-5 text-acento-texto" /> Tu equipo
        </h2>
        <ul className="vidrio divide-y divide-border overflow-hidden rounded-tarjeta">
          {(equipo.data ?? []).map((p, i) => (
            <li key={p.id} className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
              <Avatar iniciales={iniciales(p.nombre)} tono={(i * 97 + 30) % 360} />
              <span className="font-extrabold">{p.nombre}</span>
              <span className="text-texto-suave">{p.activo ? nombreDelRol(p.rol) : "Sin acceso"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-texto-suave">Para dar acceso a alguien nuevo se le manda un enlace de invitación (por ahora lo hace quien administra).</p>
      </section>
      </div>
    </>
  );
}
