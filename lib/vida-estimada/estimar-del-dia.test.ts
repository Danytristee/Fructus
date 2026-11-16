import { describe, expect, it, vi } from "vitest";

import { SIN_HECHOS, type VidaVigente } from "../vida-estimada-reglas";
import { estimarLaVidaDelDia, type Dependencias } from "./estimar-del-dia";

const AHORA = new Date("2026-11-17T00:05:00Z"); // 16 de noviembre, 7:05 p. m. en Lima
const fruta = (id: number, nombre: string, stock = 0) => ({ id, nombre, variedad: null, stock });
/** Estimaciones que ya rigen para esos productos (5 días, guardadas el 10 de noviembre a las 7 p. m. de Lima). */
const vigentes = (...ids: number[]) => new Map<number, VidaVigente>(ids.map((id) => [id, { dias: 5, motivo: "De antes.", dia: "2026-11-10", creadoEn: "2026-11-11T00:05:00+00:00" }]));

function armar(extra: Partial<Dependencias> = {}) {
  const guardar = vi.fn<Dependencias["guardar"]>(async () => {});
  const estimar = vi.fn<NonNullable<Dependencias["estimar"]>>(async (frutas) => ({
    estimaciones: frutas.map((f) => ({ producto_id: f.id, dias: f.tabla + 1, motivo: "Aguanta un poco más que el promedio." })),
  }));
  const deps: Dependencias = {
    leerFrutas: async () => [fruta(1, "Mango", 5), fruta(2, "Papaya")],
    leerVigentes: async () => new Map(),
    leerHechos: async () => SIN_HECHOS,
    estimar,
    guardar,
    ...extra,
  };
  return { deps, guardar, estimar };
}

describe("estimarLaVidaDelDia", () => {
  it("pide las frutas sin estimación, guarda lo aceptado con el día de Lima y cuenta lo que hizo", async () => {
    const { deps, guardar, estimar } = armar();
    const informe = await estimarLaVidaDelDia(deps, AHORA);
    expect(estimar).toHaveBeenCalledWith([
      { id: 1, fruta: "Mango", tabla: 7, minimo: 4, maximo: 10 },
      { id: 2, fruta: "Papaya", tabla: 5, minimo: 3, maximo: 7 },
    ]);
    expect(guardar).toHaveBeenCalledWith("2026-11-16", [
      { productoId: 1, dias: 8, motivo: "Aguanta un poco más que el promedio.", recortada: false },
      { productoId: 2, dias: 6, motivo: "Aguanta un poco más que el promedio.", recortada: false },
    ]);
    expect(informe).toEqual({ motivo: "estimado", pedidas: 2, ajustes: 0, guardadas: 2, recortadas: 0 });
  });

  it("si todas las frutas ya tienen estimación, no llama al modelo ni guarda nada", async () => {
    const { deps, guardar, estimar } = armar({ leerVigentes: async () => vigentes(1, 2) });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "sin-novedad", pedidas: 0, ajustes: 0, guardadas: 0, recortadas: 0 });
    expect(estimar).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("sin la clave del modelo no hace nada, y lo dice: Stock sigue con la tabla", async () => {
    const { deps, guardar } = armar({ estimar: null });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "sin-configurar", pedidas: 2, ajustes: 0, guardadas: 0, recortadas: 0 });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("si el modelo no responde, no lanza: informa el fallo con su código y no guarda nada", async () => {
    const error = Object.assign(new Error("se acabó el tiempo"), { name: "APIConnectionTimeoutError" });
    const { deps, guardar } = armar({ estimar: async () => Promise.reject(error) });
    const informe = await estimarLaVidaDelDia(deps, AHORA);
    expect(informe).toEqual({ motivo: "fallo", pedidas: 2, ajustes: 0, guardadas: 0, recortadas: 0, codigo: "APIConnectionTimeoutError" });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("si no se puede leer el catálogo tampoco lanza: el aviso de la noche no depende de esto", async () => {
    const { deps } = armar({ leerFrutas: async () => Promise.reject(new Error("la base no respondió")) });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toMatchObject({ motivo: "fallo", pedidas: 0, guardadas: 0 });
  });

  it("cuenta lo que hubo que meter al margen, y no guarda lo que el modelo inventó", async () => {
    const { deps, guardar } = armar({
      estimar: async () => ({
        estimaciones: [
          { producto_id: 1, dias: 40, motivo: "Dura muchísimo." },
          { producto_id: 77, dias: 5, motivo: "Fruta que nadie pidió." },
        ],
      }),
    });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "estimado", pedidas: 2, ajustes: 0, guardadas: 1, recortadas: 1 });
    expect(guardar).toHaveBeenCalledWith("2026-11-16", [{ productoId: 1, dias: 10, motivo: "Dura muchísimo.", recortada: true }]);
  });

  it("si el modelo contesta pero nada sirve, no guarda y lo informa", async () => {
    const { deps, guardar } = armar({ estimar: async () => ({ estimaciones: [] }) });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "fallo", pedidas: 2, ajustes: 0, guardadas: 0, recortadas: 0, codigo: "sin-estimaciones" });
    expect(guardar).not.toHaveBeenCalled();
  });

  describe("se corrige sola", () => {
    // La papaya (2) ya tenía 5 días. El 15 alguien revisó la llegada del 9 y seguía buena: iba por 1.4 de su vida.
    const hechos = { ...SIN_HECHOS, revisiones: [{ productoId: 2, llegadaDia: "2026-11-09", estado: null, dia: "2026-11-15", creadoEn: "2026-11-15T15:00:00+00:00" }] };

    it("la fruta con evidencia nueva vuelve al pedido con lo que rige y su paso; el ajuste se guarda acotado", async () => {
      const estimar = vi.fn<NonNullable<Dependencias["estimar"]>>(async () => ({ estimaciones: [{ producto_id: 2, dias: 9, motivo: "Aguantó bastante más de lo calculado." }] }));
      const { deps, guardar } = armar({ leerVigentes: async () => vigentes(1, 2), leerHechos: async () => hechos, estimar });
      const informe = await estimarLaVidaDelDia(deps, AHORA);
      expect(estimar).toHaveBeenCalledWith([{ id: 2, fruta: "Papaya", tabla: 5, actual: 5, minimo: 4, maximo: 6, evidencia: [{ tipo: "sigue_buena", haceDias: 1, gastado: 1.4 }] }]);
      expect(guardar).toHaveBeenCalledWith("2026-11-16", [{ productoId: 2, dias: 6, motivo: "Aguantó bastante más de lo calculado.", recortada: true }]);
      expect(informe).toEqual({ motivo: "estimado", pedidas: 1, ajustes: 1, guardadas: 1, recortadas: 1 });
    });

    it("si no se puede leer lo que pasó en el puesto, no hay ajustes esa noche, pero las frutas nuevas igual se estiman", async () => {
      const { deps, estimar } = armar({ leerVigentes: async () => vigentes(2), leerHechos: async () => Promise.reject(new Error("la base no respondió")) });
      expect(await estimarLaVidaDelDia(deps, AHORA)).toMatchObject({ motivo: "estimado", pedidas: 1, ajustes: 0, guardadas: 1 });
      expect(estimar).toHaveBeenCalledWith([{ id: 1, fruta: "Mango", tabla: 7, minimo: 4, maximo: 10 }]);
    });
  });
});
