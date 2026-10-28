import { Mic } from "lucide-react";

import { Encabezado } from "@/components/marco/Encabezado";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { formatearFecha } from "@/lib/formato";
import { exigirSesion } from "@/lib/sesion";

// «Hoy», todavía sin el resumen ni el botón de voz: llegan en A3 y A4.
export default async function Hoy() {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.from("productos").select("id", { head: true, count: "exact" });
  if (error) console.error("hoy: la base no respondió", { codigo: error.code });

  return (
    <>
      <Encabezado titulo="Hoy" subtitulo={formatearFecha(new Date())} />
      {error ? (
        <Aviso titulo="No pudimos leer tus datos">Revisa tu señal y vuelve a abrir la app. Lo que ya guardaste no se pierde.</Aviso>
      ) : (
        <Vacio icono={<Mic />} titulo="Aquí va a estar tu día">
          Lo que vendiste, lo que cobraste y quién te debe. Muy pronto lo vas a dictar con el botón de voz.
        </Vacio>
      )}
    </>
  );
}
