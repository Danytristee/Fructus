import { describe, expect, it } from "vitest";

import { avisoDescarte, nombreOperacion } from "./nombre-operacion-reglas";

describe("nombreOperacion", () => {
  it("nombra cada operación con su género", () => {
    expect(nombreOperacion("venta")).toEqual({ uno: "una venta", ese: "esa venta", lo: "la" });
    expect(nombreOperacion("abono")).toEqual({ uno: "un abono", ese: "ese abono", lo: "lo" });
    expect(nombreOperacion("gasto").ese).toBe("ese gasto");
    expect(nombreOperacion("merma").uno).toBe("una merma");
  });

  it("lo que no es una operación que se guarda se llama «operación»", () => {
    expect(nombreOperacion("consulta")).toEqual({ uno: "una operación", ese: "esa operación", lo: "la" });
  });
});

describe("avisoDescarte", () => {
  it("dice qué no guardó, y no lo niega si no sabe", () => {
    expect(avisoDescarte("venta", false)).toBe("No guardé esa venta.");
    expect(avisoDescarte("abono", false)).toBe("No guardé ese abono.");
    expect(avisoDescarte("abono", true)).toBe("Lo descarté. Si alcanzó a guardarse, lo ves en «Lo último».");
  });
});
