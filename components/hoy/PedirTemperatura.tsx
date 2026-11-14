import { Thermometer } from "lucide-react";

import { TemperaturaAMano } from "@/components/frescura/TemperaturaAMano";
import { diaDeLima } from "@/lib/formato";
import { exigirSesion } from "@/lib/sesion";
import { leerTemperaturas } from "@/lib/temperatura";
import { diaAnterior, hayQuePedirla, temperaturaDe } from "@/lib/temperatura-reglas";

// «¿Cuánto marca el termómetro?» en «Hoy»: solo si falta la de hoy y esta semana ya se anotó alguna (lib/temperatura-reglas.ts).
// Sin eso no ocupa lugar. También se dicta: «hoy hizo 29 grados».
export async function PedirTemperatura() {
  const { supabase } = await exigirSesion();
  const lecturas = await leerTemperaturas(supabase).catch((e: unknown) => {
    console.error("hoy: no se pudo leer la temperatura", { error: e instanceof Error ? e.message : "desconocido" });
    return null;
  });
  const hoy = diaDeLima(new Date());
  if (!lecturas || !hayQuePedirla(lecturas, hoy)) return null;

  return (
    <section aria-label="Falta la temperatura de hoy" className="vidrio mt-2.5 grid animate-subir gap-3 rounded-tarjeta p-4 [animation-delay:240ms]">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
        <span className="grid size-[52px] place-items-center rounded-[18px] bg-sol/12 text-sol">
          <Thermometer aria-hidden />
        </span>
        <span className="grid min-w-0">
          <span className="font-extrabold">¿Cuánto marca el termómetro?</span>
          <span className="text-base text-texto-suave">Falta la temperatura de hoy</span>
        </span>
      </div>
      <TemperaturaAMano hoy={null} ayer={temperaturaDe(lecturas, diaAnterior(hoy))} etiqueta="Anotar la temperatura" />
    </section>
  );
}
