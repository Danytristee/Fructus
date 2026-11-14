import { describe, expect, it } from "vitest";

import { cuandoLlego, deCuando, diasEntre, estimarLlegada, factorCalor, hastaCuando, llegadasEnStock, temperaturaParaContar } from "./frescura-reglas";

// La semana de la maqueta: lunes 9 a sábado 14 de noviembre de 2026, con calor.
const HOY = "2026-11-14";
const calor = [27, 29, 31, 30, 30, 29].map((grados, i) => ({ dia: `2026-11-${String(9 + i).padStart(2, "0")}`, grados }));
const fresca = [23, 24, 24, 23, 25, 24].map((grados, i) => ({ dia: `2026-11-${String(9 + i).padStart(2, "0")}`, grados }));

describe("factorCalor", () => {
  it("a temperatura normal la fruta se gasta a su ritmo; cada 10 grados de más, el doble", () => {
    expect(factorCalor(24)).toBe(1);
    expect(factorCalor(34)).toBe(2);
    expect(factorCalor(14)).toBe(0.5);
  });
});

describe("temperaturaParaContar", () => {
  it("usa la del día si se anotó", () => expect(temperaturaParaContar(calor, "2026-11-11")).toEqual({ grados: 31, anotada: true }));

  it("un día sin lectura se cuenta con la última anotada, y lo dice", () => {
    expect(temperaturaParaContar([{ dia: "2026-11-12", grados: 30 }], "2026-11-14")).toEqual({ grados: 30, anotada: false });
  });

  it("no arrastra una lectura de hace más de una semana: cuenta con la normal", () => {
    expect(temperaturaParaContar([{ dia: "2026-11-01", grados: 33 }], "2026-11-14")).toEqual({ grados: 24, anotada: false });
  });

  it("antes de la primera lectura no hay nada que arrastrar: la normal", () => {
    expect(temperaturaParaContar(calor, "2026-11-05")).toEqual({ grados: 24, anotada: false });
    expect(temperaturaParaContar([], HOY)).toEqual({ grados: 24, anotada: false });
  });
});

describe("llegadasEnStock", () => {
  // 7 a. m. de Lima de cada día.
  const entrada = (dia: string, cantidad: number) => ({ fecha: `${dia}T12:00:00Z`, cantidad });

  it("lo primero que entra es lo primero que sale: lo nuevo cubre el stock y lo más viejo queda a medias", () => {
    const entradas = [entrada("2026-11-09", 40), entrada("2026-11-12", 30)];
    expect(llegadasEnStock(42, entradas)).toEqual([
      { dia: "2026-11-09", cajas: 12, estado: null },
      { dia: "2026-11-12", cajas: 30, estado: null },
    ]);
  });

  it("si lo nuevo alcanza, lo viejo ya se vendió", () => expect(llegadasEnStock(20, [entrada("2026-11-09", 40), entrada("2026-11-12", 30)])).toEqual([{ dia: "2026-11-12", cajas: 20, estado: null }]));

  it("dos entradas del mismo día son una sola llegada", () => {
    expect(llegadasEnStock(25, [entrada("2026-11-12", 10), { fecha: "2026-11-12T20:00:00Z", cantidad: 15 }])).toEqual([{ dia: "2026-11-12", cajas: 25, estado: null }]);

    // Si una llegó verde y otra madura, son dos llegadas: no duran lo mismo.
    expect(llegadasEnStock(25, [{ ...entrada("2026-11-12", 10), estado: "verde" }, { fecha: "2026-11-12T20:00:00Z", cantidad: 15, estado: "maduro" }])).toEqual([
      { dia: "2026-11-12", cajas: 15, estado: "maduro" },
      { dia: "2026-11-12", cajas: 10, estado: "verde" },
    ]);
  });

  it("el día es el de Lima: una entrada de las 9 p. m. no cuenta para el día siguiente", () => {
    expect(llegadasEnStock(5, [{ fecha: "2026-11-13T02:00:00Z", cantidad: 5 }])).toEqual([{ dia: "2026-11-12", cajas: 5, estado: null }]);
  });

  it("sin stock no hay llegadas; con más stock que entradas conocidas no se inventa una fecha", () => {
    expect(llegadasEnStock(0, [entrada("2026-11-12", 30)])).toEqual([]);
    expect(llegadasEnStock(50, [entrada("2026-11-12", 30)])).toEqual([{ dia: "2026-11-12", cajas: 30, estado: null }]);
  });
});

describe("estimarLlegada", () => {
  it("mango que aguanta 8 días y llegó el lunes: con la semana de calor, hoy sábado es su último día y perdió 2", () => {
    const e = estimarLlegada("2026-11-09", 8, calor, HOY);
    expect(e).toMatchObject({ restan: 0, atraso: 0, fin: HOY, finNormal: "2026-11-16", perdidos: 2, gastado: 1 });
    expect(e.dias.map((d) => d.grados)).toEqual([27, 29, 31, 30, 30, 29]);
  });

  it("la misma caja en una semana fresca no pierde ningún día: todavía le quedan 3 (con 23° gasta un poco menos)", () => {
    expect(estimarLlegada("2026-11-09", 8, fresca, HOY)).toMatchObject({ restan: 3, fin: "2026-11-17", perdidos: 0 });
  });

  it("sin ninguna temperatura anotada cuenta como la tabla de siempre: 8 días son 8 días", () => {
    const e = estimarLlegada("2026-11-09", 8, [], HOY);
    expect(e).toMatchObject({ restan: 2, fin: "2026-11-16", finNormal: "2026-11-16", perdidos: 0 });
    expect(e.gastado).toBeCloseTo(6 / 8);
    expect(e.dias.every((d) => !d.anotada && d.grados === 24)).toBe(true);
  });

  it("lo que se acaba mañana dice que le queda un día", () => {
    // Plátano pintón de 5 días que llegó el jueves: jueves, viernes y sábado de calor.
    expect(estimarLlegada("2026-11-12", 5, calor, HOY)).toMatchObject({ restan: 1, fin: "2026-11-15", perdidos: 1 });
  });

  it("si su último día bueno ya pasó, dice hace cuánto", () => {
    // Aguantaba 4 días y llegó el lunes: con 27°, 29° y 31° se acabó el miércoles. Hoy es sábado.
    expect(estimarLlegada("2026-11-09", 4, calor, HOY)).toMatchObject({ restan: 0, atraso: 3, fin: "2026-11-11" });
  });

  it("lo que llegó hoy cuenta hoy como su primer día", () => {
    const e = estimarLlegada(HOY, 7, [], HOY);
    expect(e.dias).toHaveLength(1);
    expect(e).toMatchObject({ restan: 6, fin: "2026-11-20" });
  });

  it("una fecha del futuro (un reloj mal puesto) cuenta desde hoy", () => expect(estimarLlegada("2026-11-20", 7, [], HOY).dias).toHaveLength(1));

  it("los días que faltan se cuentan con la temperatura de hoy: si hoy sube, le queda menos", () => {
    const hoyMasCalor = calor.map((l) => (l.dia === HOY ? { ...l, grados: 35 } : l));
    expect(estimarLlegada("2026-11-12", 5, calor, HOY).restan).toBe(1);
    expect(estimarLlegada("2026-11-12", 5, hoyMasCalor, HOY).restan).toBe(0);
  });
});

describe("cómo se dice en el puesto", () => {
  it("cuándo llegó", () => {
    expect(cuandoLlego(HOY, HOY)).toBe("hoy");
    expect(cuandoLlego("2026-11-13", HOY)).toBe("ayer");
    expect(cuandoLlego("2026-11-09", HOY)).toBe("el lunes");
    expect(cuandoLlego("2026-11-05", HOY)).toBe("hace 9 días");
  });

  it("de qué llegada es", () => {
    expect(deCuando("2026-11-09", HOY)).toBe("del lunes");
    expect(deCuando("2026-11-13", HOY)).toBe("de ayer");
    expect(deCuando(HOY, HOY)).toBe("de hoy");
    expect(deCuando("2026-11-05", HOY)).toBe("de hace 9 días");
  });

  it("hasta cuándo aguanta", () => {
    expect(hastaCuando(HOY, HOY)).toBe("hoy");
    expect(hastaCuando("2026-11-15", HOY)).toBe("mañana");
    expect(hastaCuando("2026-11-16", HOY)).toBe("el lunes 16");
  });

  it("diasEntre cuenta días enteros", () => {
    expect(diasEntre("2026-11-09", HOY)).toBe(5);
    expect(diasEntre(HOY, "2026-11-09")).toBe(-5);
  });
});
