import { TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { TemperaturaAMano } from "@/components/frescura/TemperaturaAMano";
import { Renglon } from "@/components/ui/Renglon";
import type { Alerta, ResumenInventario } from "@/lib/inventario-reglas";
import { diaAnterior, hayQuePedirla, temperaturaDe, type TemperaturaDia } from "@/lib/temperatura-reglas";

const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;
// Para qué se pide la temperatura. El título dice «del puesto»: en la 2.ª prueba a ciegas preguntaron «¿de qué?». Decía «Así sé qué fruta sale primero»: en la 2.ª prueba a ciegas se leyó «así se» y «sale
// primero» como «la que más se vende» (/formidable 2026-11-15).
const PARA_QUE = "Con ella sé qué vender primero";

type Props = {
  /** Lo que dice Stock; null si no se pudo leer. */
  inventario: { resumen: ResumenInventario; alertas: Alerta[] } | null;
  /** La temperatura de la semana; null si no se pudo leer o si quien mira no puede anotarla. */
  lecturas: TemperaturaDia[] | null;
  /** El día de Lima de hoy (AAAA-MM-DD). */
  hoy: string;
  className?: string;
};

// Lo que el puesto pide hoy, en renglones justo debajo de lo vendido: la fruta que tiene que salir (a un toque de Stock) y la
// temperatura, si falta la de hoy (lib/temperatura-reglas.ts). Sin nada que pedir, no ocupa lugar.
// Antes iban al final de «Hoy», detrás del botón de voz: en la prueba a ciegas nadie vio que la app pidiera algo
// (/formidable 2026-11-14).
export function AvisosDeHoy({ inventario, lecturas, hoy, className }: Props) {
  const pedir = lecturas !== null && hayQuePedirla(lecturas, hoy);
  const hayAvisos = inventario !== null && inventario.alertas.length > 0;
  if (!hayAvisos && !pedir) return null;
  return (
    <ul aria-label="Lo que pide tu puesto hoy" className={cn("vidrio animate-subir divide-y divide-border overflow-hidden rounded-tarjeta [animation-delay:40ms]", className)}>
      {hayAvisos && (
        <li>
          <Renglon href="/stock" icono={<TriangleAlert aria-hidden />} tono="deuda" titulo={tituloDelStock(inventario.resumen, inventario.alertas.length)} />
        </li>
      )}
      {pedir && (
        <li>
          <TemperaturaAMano hoy={null} ayer={temperaturaDe(lecturas, diaAnterior(hoy))} etiqueta="Anota la temperatura del puesto" detalle={PARA_QUE} />
        </li>
      )}
    </ul>
  );
}

/** «2 frutas tienen que salir hoy y 1 por reponer»; si los avisos son de otra clase, cuántos son. */
function tituloDelStock(resumen: ResumenInventario, avisos: number): string {
  const partes = [
    resumen.frutasPorMalograrse > 0 && plural(resumen.frutasPorMalograrse, "fruta tiene que salir hoy", "frutas tienen que salir hoy"),
    resumen.porReponer > 0 && plural(resumen.porReponer, "por reponer", "por reponer"),
  ].filter(Boolean);
  return partes.length ? partes.join(" y ") : plural(avisos, "aviso de tu stock", "avisos de tu stock");
}
