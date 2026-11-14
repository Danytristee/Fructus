// Cómo se nombra en los avisos de «Hoy» lo que se dictó: «Tienes un abono sin confirmar», «No guardé esa merma».
// Es pequeño a propósito: VozHoy va en la primera carga de «Hoy» (CLAUDE.md, regla 9). Lógica pura.

type TipoOperacion = "venta" | "abono" | "compra" | "merma" | "gasto" | "temperatura";

const FEMENINO: Record<TipoOperacion, boolean> = { venta: true, abono: false, compra: true, merma: true, gasto: false, temperatura: true };

export function nombreOperacion(tipo: string) {
  const conocido = tipo in FEMENINO;
  const nombre = conocido ? tipo : "operación";
  const f = conocido ? FEMENINO[tipo as TipoOperacion] : true;
  return {
    /** «una venta», «un abono» */
    uno: `${f ? "una" : "un"} ${nombre}`,
    /** «esa venta», «ese abono» */
    ese: `${f ? "esa" : "ese"} ${nombre}`,
    /** «la», «lo»: «La descarté» */
    lo: f ? "la" : "lo",
  };
}

/**
 * El aviso al descartar una tarjeta. Si el último Confirmar no tuvo respuesta, pudo haberse guardado: el aviso no lo
 * niega (/chaos 2026-10-29).
 */
export function avisoDescarte(tipo: string, incierto: boolean): string {
  const { lo, ese } = nombreOperacion(tipo);
  return incierto ? `${lo === "la" ? "La" : "Lo"} descarté. Si alcanzó a guardarse, ${lo} ves en «Lo último».` : `No guardé ${ese}.`;
}
