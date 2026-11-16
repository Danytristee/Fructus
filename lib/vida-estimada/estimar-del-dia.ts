// La estimación de cada noche: mira qué frutas no tienen estimación y cuáles juntaron evidencia nueva (mermas, «Sigue buena»),
// se las pregunta al modelo, guarda lo que se acepta y cuenta cómo salió (ADR-0021).
//
// Todo lo que toca el mundo (la base y el modelo) llega como parámetro: aquí vive el orden de las cosas y se prueba sin red ni
// base. Lo cablea lib/vida-estimada/servidor.ts (server-only) y lo llama app/api/cron/resumen-diario/route.ts.
// Nunca lanza: si algo falla, Stock sigue contando con lo que ya tenía (la última estimación o la tabla) y aquí solo se informa.
import { diaDeLima } from "../formato";
import type { PartesProducto } from "../productos-reglas";
import { aceptarEstimaciones, frutasPorEstimar, SIN_HECHOS, type EstimacionAceptada, type FrutaPorEstimar, type Hechos, type RespuestaDelModelo, type VidaVigente } from "../vida-estimada-reglas";

export type Dependencias = {
  /** Las frutas activas del catálogo, con las cajas que tienen hoy. */
  leerFrutas: () => Promise<(PartesProducto & { id: number; stock: number })[]>;
  /** La estimación que rige para cada fruta que ya tiene una, con el momento en que se guardó. */
  leerVigentes: () => Promise<ReadonlyMap<number, VidaVigente>>;
  /** Lo que pasó en el puesto en las últimas semanas (mermas, revisiones, llegadas y temperaturas): de ahí sale la evidencia. */
  leerHechos: (ahora: Date) => Promise<Hechos>;
  /** La llamada al modelo. null si el servidor no tiene la clave: no se estima y se dice. */
  estimar: ((frutas: FrutaPorEstimar[]) => Promise<RespuestaDelModelo>) | null;
  guardar: (dia: string, estimaciones: EstimacionAceptada[]) => Promise<void>;
};

export type InformeVida = {
  motivo: "estimado" | "sin-novedad" | "sin-configurar" | "fallo";
  /** Frutas que se le preguntaron al modelo (o que se le iban a preguntar). */
  pedidas: number;
  /** De las pedidas, cuántas ya tenían estimación y volvieron por evidencia nueva. */
  ajustes: number;
  guardadas: number;
  /** De las guardadas, cuántas hubo que meter al margen de la tabla. */
  recortadas: number;
  /** Qué falló, en una palabra: el nombre del error o un código propio. Nunca un mensaje con datos. */
  codigo?: string;
};

export async function estimarLaVidaDelDia(deps: Dependencias, ahora: Date): Promise<InformeVida> {
  const informe = { pedidas: 0, ajustes: 0, guardadas: 0, recortadas: 0 };
  try {
    const [frutas, vigentes, hechos] = await Promise.all([
      deps.leerFrutas(),
      deps.leerVigentes(),
      // Sin los hechos no hay ajustes esta noche, pero las frutas nuevas igual se estiman: se registra y se sigue.
      deps.leerHechos(ahora).catch((e: unknown) => {
        console.error("vida estimada: no se pudo leer la evidencia del puesto", { error: e instanceof Error ? e.name : "desconocido" });
        return SIN_HECHOS;
      }),
    ]);
    const pedidas = frutasPorEstimar(frutas, vigentes, hechos, diaDeLima(ahora));
    informe.pedidas = pedidas.length;
    informe.ajustes = pedidas.filter((f) => f.actual !== undefined).length;
    if (pedidas.length === 0) return { motivo: "sin-novedad", ...informe };
    if (!deps.estimar) return { motivo: "sin-configurar", ...informe };

    const aceptadas = aceptarEstimaciones(pedidas, await deps.estimar(pedidas));
    if (aceptadas.length === 0) return { motivo: "fallo", ...informe, codigo: "sin-estimaciones" };
    await deps.guardar(diaDeLima(ahora), aceptadas);
    return { motivo: "estimado", ...informe, guardadas: aceptadas.length, recortadas: aceptadas.filter((e) => e.recortada).length };
  } catch (e) {
    return { motivo: "fallo", ...informe, codigo: e instanceof Error ? e.name : "desconocido" };
  }
}
