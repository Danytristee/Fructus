import { describe, expect, it } from "vitest";

import { borradorTemperatura, faltaTemperatura, fueCorregidaTemperatura, moverGrados, pedidoTemperatura } from "./confirmar-temperatura-reglas";

const tarjeta = (grados: number) => ({ tipo: "temperatura" as const, grados, ayer: 30 });

describe("borradorTemperatura", () => {
  it("parte de lo que se entendió, con un decimal como mucho", () => {
    expect(borradorTemperatura(tarjeta(29))).toEqual({ grados: 29 });
    expect(borradorTemperatura(tarjeta(28.46))).toEqual({ grados: 28.5 });
  });
});

describe("moverGrados", () => {
  it("sube y baja de a un grado", () => {
    expect(moverGrados({ grados: 29 }, 1)).toEqual({ grados: 30 });
    expect(moverGrados({ grados: 29 }, -1)).toEqual({ grados: 28 });
  });

  it("no se sale de lo que puede marcar el termómetro", () => {
    expect(moverGrados({ grados: 45 }, 1)).toEqual({ grados: 45 });
    expect(moverGrados({ grados: 5 }, -1)).toEqual({ grados: 5 });
  });

  it("un «290» mal oído vuelve al rango al primer toque", () => expect(moverGrados({ grados: 290 }, -1)).toEqual({ grados: 45 }));
});

describe("faltaTemperatura y pedidoTemperatura", () => {
  it("con una temperatura posible no falta nada y sale la fila", () => {
    expect(faltaTemperatura({ grados: 29 })).toEqual([]);
    expect(pedidoTemperatura({ grados: 29 }, 7)).toEqual({ grados: 29, comando_voz_id: 7 });
  });

  it("un número que no es clima no se guarda", () => {
    expect(faltaTemperatura({ grados: 290 })).toEqual(["grados"]);
    expect(pedidoTemperatura({ grados: 290 }, 7)).toBeNull();
    expect(pedidoTemperatura({ grados: 2 }, 7)).toBeNull();
  });
});

describe("fueCorregidaTemperatura", () => {
  it("no si se confirma tal cual", () => expect(fueCorregidaTemperatura(tarjeta(29), { grados: 29 })).toBe(false));
  it("sí si se movió", () => expect(fueCorregidaTemperatura(tarjeta(29), { grados: 31 })).toBe(true));
  it("redondear un decimal de más no cuenta como corrección", () => expect(fueCorregidaTemperatura(tarjeta(28.46), { grados: 28.5 })).toBe(false));
});
