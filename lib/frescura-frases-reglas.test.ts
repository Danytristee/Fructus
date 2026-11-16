import { describe, expect, it } from "vitest";

import { comoYCuandoLlego, consejoDeLlegada, etiquetaDeLlegada, explicacionDelCalor, fraseDeLlegadas, nombreDeLlegada, origenDeLaCuenta, tonoDeLlegada, veredictoDeLlegada } from "./frescura-frases-reglas";
import { estimarLlegada, llegadaSinFecha } from "./frescura-reglas";

const HOY = "2026-11-14";
const calor = [27, 29, 31, 30, 30, 29].map((grados, i) => ({ dia: `2026-11-${String(9 + i).padStart(2, "0")}`, grados }));
const lote = (dia: string, vida: number, cajas: number, estado: "verde" | "pinton" | "maduro" | null = null, lecturas = calor) => ({ dia, cajas, estado, ...estimarLlegada(dia, vida, lecturas, HOY) });

describe("etiqueta y tono de una llegada", () => {
  it("dice cuándo sale, y el color acompaña", () => {
    expect([etiquetaDeLlegada(0), tonoDeLlegada(0)]).toEqual(["Sale hoy", "hoy"]);
    expect([etiquetaDeLlegada(1), tonoDeLlegada(1)]).toEqual(["Sale mañana", "manana"]);
    expect([etiquetaDeLlegada(5), tonoDeLlegada(5)]).toEqual(["5 días", "bien"]);
    expect(etiquetaDeLlegada(2)).toBe("2 días");
  });
});

describe("fraseDeLlegadas", () => {
  it("una sola llegada dice lo suyo", () => {
    expect(fraseDeLlegadas([{ cajas: 12, restan: 0 }])).toBe("Sale hoy");
    expect(fraseDeLlegadas([{ cajas: 12, restan: 1 }])).toBe("Sale mañana");
    expect(fraseDeLlegadas([{ cajas: 12, restan: 5 }])).toBe("Le quedan 5 días");
  });

  it("con varias dice cuántas cajas hay en cada caso", () => {
    expect(fraseDeLlegadas([{ cajas: 12, restan: 0 }, { cajas: 30, restan: 5 }])).toBe("12 salen hoy · 30 aguantan 5 días");
    expect(fraseDeLlegadas([{ cajas: 1, restan: 1 }, { cajas: 1, restan: 3 }])).toBe("1 sale mañana · 1 aguanta 3 días");
  });

  it("sin llegadas conocidas no dice nada", () => expect(fraseDeLlegadas([])).toBe(""));
});

describe("cómo se nombra una llegada", () => {
  it("en una fila: cuántas cajas y de qué día", () => expect(nombreDeLlegada(lote("2026-11-09", 8, 12), HOY)).toBe("12 cajas del lunes"));
  it("en la hoja: cuándo llegó y cómo, si se dijo", () => {
    expect(comoYCuandoLlego(lote("2026-11-09", 8, 12, "pinton"), HOY)).toBe("llegaron el lunes, pintonas");
    expect(comoYCuandoLlego(lote("2026-11-13", 8, 1), HOY)).toBe("llegó ayer");
  });
});

describe("una llegada de hace más de 45 días (no se sabe su día)", () => {
  const vieja = { dia: "2026-09-30", cajas: 4, estado: null, antes: true as const, ...llegadaSinFecha("2026-09-30", HOY) };
  it("se nombra así en la fila y en la hoja", () => {
    expect(nombreDeLlegada(vieja, HOY)).toBe("4 cajas de hace más de 45 días");
    expect(comoYCuandoLlego(vieja, HOY)).toBe("llegaron hace más de 45 días");
  });
  it("pide revisarla, sin inventar cuál fue su último día bueno", () => {
    expect(veredictoDeLlegada(vieja, HOY)).toEqual({ titulo: "Revísala antes de vender", detalle: "Lleva más de 45 días en el puesto." });
    expect([etiquetaDeLlegada(vieja.restan), tonoDeLlegada(vieja.restan)]).toEqual(["Sale hoy", "hoy"]);
  });
});

describe("consejoDeLlegada", () => {
  it("lo que sale hoy o mañana dice qué hacer; lo que aguanta, nada", () => {
    expect(consejoDeLlegada(lote("2026-11-09", 8, 12))).toBe("Véndelo hoy, antes que lo nuevo. Si no sale, ofrécelo con rebaja.");
    expect(consejoDeLlegada(lote("2026-11-12", 5, 20))).toBe("Ponlo adelante y véndelo primero.");
    expect(consejoDeLlegada(lote("2026-11-12", 11, 30))).toBeNull();
  });

  // 2.ª prueba a ciegas de /formidable (2026-11-15): «Su último día bueno fue ayer» junto a «Véndelo hoy» dejaba la duda de si
  // la fruta ya estaba mala. La app no lo sabe: dice qué hacer en los dos casos.
  it("si su último día bueno ya pasó, dice qué hacer si sigue buena y qué hacer si no", () => {
    const pasada = "Si sigue buena, véndela hoy con rebaja. Si no, anótala con «Se malogró».";
    expect(consejoDeLlegada(lote("2026-11-09", 4, 6))).toBe(pasada);
    expect(consejoDeLlegada({ dia: "2026-09-30", cajas: 4, estado: null, antes: true as const, ...llegadaSinFecha("2026-09-30", HOY) })).toBe(pasada);
  });
});

describe("veredictoDeLlegada y explicacionDelCalor", () => {
  it("el mango del lunes, con la semana de calor: sale hoy y el calor le quitó 2 días", () => {
    const l = lote("2026-11-09", 8, 12);
    expect(veredictoDeLlegada(l, HOY)).toEqual({ titulo: "Tiene que salir hoy", detalle: "Hoy es su último día bueno." });
    // «A 24°» era la cuenta cruda: en la prueba a ciegas nadie supo de dónde salía ese número (/formidable 2026-11-14).
    expect(explicacionDelCalor(l, HOY)).toBe("Con clima normal aguantaba hasta el lunes 16. El calor le quitó 2 días.");
  });

  it("lo que sale mañana y lo que aguanta", () => {
    expect(veredictoDeLlegada(lote("2026-11-12", 5, 20), HOY)).toEqual({ titulo: "Sale mañana", detalle: "Mañana es su último día bueno." });
    expect(veredictoDeLlegada(lote("2026-11-12", 11, 30), HOY)).toEqual({ titulo: "Le quedan 5 días", detalle: "Aguanta hasta el jueves 19." });
  });

  it("si ya se pasó, pide revisarla: no dice «tiene que salir hoy» junto a «su último día bueno fue ayer»", () => {
    const l = lote("2026-11-09", 4, 6);
    expect(veredictoDeLlegada(l, HOY)).toEqual({ titulo: "Revísala antes de vender", detalle: "Su último día bueno fue hace 3 días." });
    expect(veredictoDeLlegada(lote("2026-11-09", 6, 6), HOY)).toEqual({ titulo: "Revísala antes de vender", detalle: "Su último día bueno fue ayer." });
    // A temperatura normal aguantaba hasta el jueves 12, que ya pasó: se dice «hace 2 días», no «el jueves 12».
    expect(explicacionDelCalor(l, HOY)).toBe("Con clima normal aguantaba hasta hace 2 días. El calor le quitó 1 día.");
  });

  it("sin temperaturas anotadas no le echa la culpa al calor", () => {
    expect(explicacionDelCalor(lote("2026-11-09", 8, 12, null, []), HOY)).toBe("Sin temperaturas anotadas, cada día cuenta como uno normal.");
  });

  it("con clima normal dice que no le quitó nada", () => {
    const fresca = [23, 24, 24, 23, 25, 24].map((grados, i) => ({ dia: `2026-11-${String(9 + i).padStart(2, "0")}`, grados }));
    expect(explicacionDelCalor(lote("2026-11-09", 8, 12, null, fresca), HOY)).toBe("El clima de estos días no le quitó ningún día.");
  });
});

describe("una llegada revisada hoy («Sigue buena»)", () => {
  const revisada = { ...lote("2026-11-09", 4, 6), restan: 1, atraso: 0, fin: "2026-11-15", revisada: true };

  it("el veredicto dice que la revisaste y cuándo volver a mirarla", () => {
    expect(veredictoDeLlegada(revisada, HOY)).toEqual({ titulo: "Sigue buena", detalle: "La revisaste hoy. Mañana vuelve a mirarla." });
  });

  it("el consejo es venderla hoy, aunque sea con rebaja", () => {
    expect(consejoDeLlegada(revisada)).toBe("Ponla adelante y véndela hoy, aunque sea con rebaja.");
  });
});

describe("origenDeLaCuenta", () => {
  const ia = { fuente: "ia", dias: 36, dia: "2026-11-13", motivo: "La Fuji es más firme que otras manzanas.", tabla: 30 } as const;

  it("con la tabla dice que sale de la tabla", () => {
    expect(origenDeLaCuenta({ vida: 7 }, { fuente: "tabla" }, HOY)).toBe("Para estas cajas cuento unos 7 días con clima normal, según la tabla del sistema.");
  });

  it("con la estimación dice quién, cuándo y por qué", () => {
    expect(origenDeLaCuenta({ vida: 36 }, ia, HOY)).toBe("Para estas cajas cuento unos 36 días con clima normal. Lo estimó la IA ayer: La Fuji es más firme que otras manzanas.");
    expect(origenDeLaCuenta({ vida: 36 }, { ...ia, dia: HOY }, HOY)).toContain("Lo estimó la IA hoy:");
    expect(origenDeLaCuenta({ vida: 36 }, { ...ia, dia: "2026-11-10" }, HOY)).toContain("Lo estimó la IA el martes:");
    expect(origenDeLaCuenta({ vida: 36 }, { ...ia, dia: "2026-11-01" }, HOY)).toContain("Lo estimó la IA hace 13 días:");
  });

  it("si la IA la revisó y quedó igual que la tabla, dice eso y no repite un motivo vacío", () => {
    expect(origenDeLaCuenta({ vida: 30 }, { ...ia, dias: 30, motivo: "No encuentro nada que la distinga de la tabla." }, HOY)).toBe(
      "Para estas cajas cuento unos 30 días con clima normal. La IA lo revisó ayer y coincide con la tabla del sistema.",
    );
  });

  it("los días de la llegada se dicen enteros, y uno solo en singular", () => {
    expect(origenDeLaCuenta({ vida: 9.8 }, { fuente: "tabla" }, HOY)).toContain("unos 10 días");
    expect(origenDeLaCuenta({ vida: 1 }, { fuente: "tabla" }, HOY)).toContain("cuento un día");
  });

  it("al motivo que llega sin punto se le pone", () => {
    expect(origenDeLaCuenta({ vida: 8 }, { ...ia, motivo: "Llega firme" }, HOY)).toMatch(/Llega firme\.$/);
  });

  it("de las cajas sin cuenta (hace más de 45 días) no dice nada", () => {
    expect(origenDeLaCuenta({ vida: null }, ia, HOY)).toBeNull();
  });
});
