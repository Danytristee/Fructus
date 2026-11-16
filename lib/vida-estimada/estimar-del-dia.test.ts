import { describe, expect, it, vi } from "vitest";

import { estimarLaVidaDelDia, type Dependencias } from "./estimar-del-dia";

const AHORA = new Date("2026-11-17T00:05:00Z"); // 16 de noviembre, 7:05 p. m. en Lima
const fruta = (id: number, nombre: string, stock = 0) => ({ id, nombre, variedad: null, stock });

function armar(extra: Partial<Dependencias> = {}) {
  const guardar = vi.fn<Dependencias["guardar"]>(async () => {});
  const estimar = vi.fn<NonNullable<Dependencias["estimar"]>>(async (frutas) => ({
    estimaciones: frutas.map((f) => ({ producto_id: f.id, dias: f.tabla + 1, motivo: "Aguanta un poco más que el promedio." })),
  }));
  const deps: Dependencias = {
    leerFrutas: async () => [fruta(1, "Mango", 5), fruta(2, "Papaya")],
    leerYaEstimadas: async () => new Set<number>(),
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
      { id: 1, fruta: "Mango", tabla: 7 },
      { id: 2, fruta: "Papaya", tabla: 5 },
    ]);
    expect(guardar).toHaveBeenCalledWith("2026-11-16", [
      { productoId: 1, dias: 8, motivo: "Aguanta un poco más que el promedio.", recortada: false },
      { productoId: 2, dias: 6, motivo: "Aguanta un poco más que el promedio.", recortada: false },
    ]);
    expect(informe).toEqual({ motivo: "estimado", pedidas: 2, guardadas: 2, recortadas: 0 });
  });

  it("si todas las frutas ya tienen estimación, no llama al modelo ni guarda nada", async () => {
    const { deps, guardar, estimar } = armar({ leerYaEstimadas: async () => new Set([1, 2]) });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "sin-novedad", pedidas: 0, guardadas: 0, recortadas: 0 });
    expect(estimar).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("sin la clave del modelo no hace nada, y lo dice: Stock sigue con la tabla", async () => {
    const { deps, guardar } = armar({ estimar: null });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "sin-configurar", pedidas: 2, guardadas: 0, recortadas: 0 });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("si el modelo no responde, no lanza: informa el fallo con su código y no guarda nada", async () => {
    const error = Object.assign(new Error("se acabó el tiempo"), { name: "APIConnectionTimeoutError" });
    const { deps, guardar } = armar({ estimar: async () => Promise.reject(error) });
    const informe = await estimarLaVidaDelDia(deps, AHORA);
    expect(informe).toEqual({ motivo: "fallo", pedidas: 2, guardadas: 0, recortadas: 0, codigo: "APIConnectionTimeoutError" });
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
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "estimado", pedidas: 2, guardadas: 1, recortadas: 1 });
    expect(guardar).toHaveBeenCalledWith("2026-11-16", [{ productoId: 1, dias: 10, motivo: "Dura muchísimo.", recortada: true }]);
  });

  it("si el modelo contesta pero nada sirve, no guarda y lo informa", async () => {
    const { deps, guardar } = armar({ estimar: async () => ({ estimaciones: [] }) });
    expect(await estimarLaVidaDelDia(deps, AHORA)).toEqual({ motivo: "fallo", pedidas: 2, guardadas: 0, recortadas: 0, codigo: "sin-estimaciones" });
    expect(guardar).not.toHaveBeenCalled();
  });
});
