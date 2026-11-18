import { describe, expect, it } from "vitest";

import { cuentaAntes, tramosBarra } from "./medidor-deuda-reglas";

describe("cuentaAntes: cómo estaba la cuenta antes de esta venta", () => {
  it("si debía, cuánto", () => {
    expect(cuentaAntes(2390)).toBe("Debía S/\u00a02,390.00");
  });

  it("al día", () => {
    expect(cuentaAntes(0)).toBe("No debía nada");
    // En céntimos: 0.1 + 0.2 − 0.3 no es una deuda.
    expect(cuentaAntes(0.1 + 0.2 - 0.3)).toBe("No debía nada");
  });

  it("con saldo a favor no dice «No debía nada» (/chaos 2026-11-18): dice cuánto tenía a favor", () => {
    expect(cuentaAntes(-200)).toBe("Tenía S/\u00a0200.00 a favor");
  });
});

describe("tramosBarra: lo de antes y lo de hoy, en %", () => {
  it("debía y fía más: los dos tramos suman 100", () => {
    expect(tramosBarra(300, 100)).toEqual({ antes: 75, hoy: 25 });
  });

  it("no debía nada: todo es de hoy", () => {
    expect(tramosBarra(0, 450)).toEqual({ antes: 0, hoy: 100 });
  });

  it("con saldo a favor que no alcanza: lo que debe es todo de hoy, y ningún tramo es negativo", () => {
    expect(tramosBarra(-200, 450)).toEqual({ antes: 0, hoy: 100 });
  });

  it("si con esta venta no debe nada (al día o con saldo a favor), no hay barra", () => {
    expect(tramosBarra(-450, 450)).toBeNull();
    expect(tramosBarra(-500, 450)).toBeNull();
  });
});
