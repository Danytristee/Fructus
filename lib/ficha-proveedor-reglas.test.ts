import { describe, expect, it } from "vitest";

import { historialDelProveedor, type CompraDelProveedor, type PagoLeido } from "./ficha-proveedor-reglas";

// 12 nov 2026, 10 a. m. en Lima (UTC−5).
const AHORA = new Date("2026-11-12T15:00:00Z");
const kiwi = { nombre: "Kiwi", variedad: "Riñón chileno" };

const compra = (id: number, fecha: string, condicion: "contado" | "credito"): CompraDelProveedor => ({
  id,
  fecha,
  total: 700,
  condicion,
  proveedor: { nombre: "Pacífico" },
  items: [{ cantidad: 5, producto: kiwi }],
});
const pago = (id: number, fecha: string, nota: string | null = null): PagoLeido => ({ id, fecha, monto: 500, medio: "yape", nota });

describe("historialDelProveedor", () => {
  it("junta compras y pagos por día, lo último primero, sin repetir el nombre del proveedor", () => {
    const { dias, hayMas } = historialDelProveedor(
      { compras: [compra(1, "2026-11-11T11:00:00Z", "credito"), compra(2, "2026-11-12T11:00:00Z", "contado")], pagos: [pago(7, "2026-11-12T20:00:00Z", "a cuenta")] },
      AHORA,
    );
    expect(hayMas).toBe(false);
    expect(dias.map((d) => d.etiqueta)).toEqual(["hoy", "ayer"]);
    expect(dias[0]!.operaciones.map((o) => [o.titulo, o.estado])).toEqual([
      ["Le pagaste con Yape · a cuenta", "pagaste"],
      ["Compraste 5 de kiwi riñón chileno", "compra"],
    ]);
    // La compra fiada dice que es al crédito y se marca como deuda.
    expect(dias[1]!.operaciones[0]).toMatchObject({ titulo: "Compraste 5 de kiwi riñón chileno, al crédito", estado: "credito", persona: null });
  });

  it("avisa que hay más cuando pasa el tope", () => {
    const compras = [1, 2, 3].map((i) => compra(i, `2026-11-0${i}T11:00:00Z`, "contado"));
    expect(historialDelProveedor({ compras, pagos: [] }, AHORA, 2).hayMas).toBe(true);
  });
});
