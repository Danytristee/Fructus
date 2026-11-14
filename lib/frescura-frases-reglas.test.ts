import { describe, expect, it } from "vitest";

import { comoYCuandoLlego, etiquetaDeLlegada, explicacionDelCalor, fraseDeLlegadas, nombreDeLlegada, tonoDeLlegada, veredictoDeLlegada } from "./frescura-frases-reglas";
import { estimarLlegada } from "./frescura-reglas";

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

describe("veredictoDeLlegada y explicacionDelCalor", () => {
  it("el mango del lunes, con la semana de calor: sale hoy y el calor le quitó 2 días", () => {
    const l = lote("2026-11-09", 8, 12);
    expect(veredictoDeLlegada(l, HOY)).toEqual({ titulo: "Tiene que salir hoy", detalle: "Hoy es su último día bueno." });
    expect(explicacionDelCalor(l, HOY)).toBe("A 24° aguantaba hasta el lunes 16. El calor le quitó 2 días.");
  });

  it("lo que sale mañana y lo que aguanta", () => {
    expect(veredictoDeLlegada(lote("2026-11-12", 5, 20), HOY)).toEqual({ titulo: "Sale mañana", detalle: "Mañana es su último día bueno." });
    expect(veredictoDeLlegada(lote("2026-11-12", 11, 30), HOY)).toEqual({ titulo: "Le quedan 5 días", detalle: "Aguanta hasta el jueves 19." });
  });

  it("si ya se pasó, lo dice y pide revisar la fruta", () => {
    const l = lote("2026-11-09", 4, 6);
    expect(veredictoDeLlegada(l, HOY)).toEqual({ titulo: "Tiene que salir hoy", detalle: "Su último día bueno fue hace 3 días. Revisa la fruta antes de venderla." });
    // A temperatura normal aguantaba hasta el jueves 12, que ya pasó: se dice «hace 2 días», no «el jueves 12».
    expect(explicacionDelCalor(l, HOY)).toBe("A 24° aguantaba hasta hace 2 días. El calor le quitó 1 día.");
  });

  it("sin temperaturas anotadas no le echa la culpa al calor", () => {
    expect(explicacionDelCalor(lote("2026-11-09", 8, 12, null, []), HOY)).toBe("Sin temperaturas anotadas, cada día cuenta como uno normal.");
  });

  it("con clima normal dice que no le quitó nada", () => {
    const fresca = [23, 24, 24, 23, 25, 24].map((grados, i) => ({ dia: `2026-11-${String(9 + i).padStart(2, "0")}`, grados }));
    expect(explicacionDelCalor(lote("2026-11-09", 8, 12, null, fresca), HOY)).toBe("El clima de estos días no le quitó ningún día.");
  });
});
