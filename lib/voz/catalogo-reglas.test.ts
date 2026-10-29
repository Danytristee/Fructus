import { describe, expect, it } from "vitest";

import { bloqueCatalogo, vocabularioWhisper } from "./catalogo-reglas";

describe("vocabularioWhisper", () => {
  const catalogo = {
    productos: [{ nombre: "Manzana", variedad: "Royal" }, { nombre: "Pera", variedad: "Gaucho" }],
    clientes: [{ nombre: "Luis Paredes", alias: ["don lucho", "lucho"] }, { nombre: "Juan Pérez", alias: [] }],
    proveedores: [{ nombre: "Agrícola Chao", alias: ["el de chao"] }],
  };

  it("dice el negocio, las frutas, un apodo por cliente y por proveedor, y cómo se paga", () => {
    expect(vocabularioWhisper(catalogo)).toBe(
      "Venta de fruta por cajas en La Hermelinda, Trujillo. Frutas: manzana royal, pera gaucho. Clientes: don lucho, Juan Pérez. " +
        "Proveedores: el de chao. Pagos: Yape, Plin, efectivo, transferencia, al crédito, lo debe, abonó, a cuenta.",
    );
  });

  it("con un catálogo grande se recorta sin partir una palabra", () => {
    const grande = { ...catalogo, productos: Array.from({ length: 80 }, (_, i) => ({ nombre: `Fruta${i}`, variedad: "larguísima" })) };
    const v = vocabularioWhisper(grande);
    expect(v.length).toBeLessThanOrEqual(700);
    // Termina en una palabra entera del catálogo, nunca en un pedazo («largu.»).
    expect(v).toMatch(/(fruta\d+|larguísima)\.$/);
  });
});

describe("bloqueCatalogo", () => {
  it("lista productos, clientes con sus apodos y proveedores, y aclara qué es una compra", () => {
    const bloque = bloqueCatalogo({
      productos: [{ nombre: "Mango", variedad: "Edward" }, { nombre: "Papaya", variedad: null }],
      clientes: [{ nombre: "Carlos Mendoza", alias: ["el flaco", "flaco carlos"] }, { nombre: "Juan Pérez", alias: [] }],
      proveedores: [{ nombre: "Agrícola Chao", alias: ["el de chao"] }],
    });
    expect(bloque).toContain("- Productos: mango edward, papaya.");
    expect(bloque).toContain("- Clientes: el flaco / flaco carlos (Carlos Mendoza); Juan Pérez.");
    expect(bloque).toContain("- Proveedores: el de chao (Agrícola Chao).");
    expect(bloque).toContain("nunca ventas");
  });

  it("sin clientes ni proveedores, no deja líneas vacías", () => {
    const bloque = bloqueCatalogo({ productos: [{ nombre: "Limón", variedad: null }], clientes: [], proveedores: [] });
    expect(bloque).not.toContain("Clientes:");
    expect(bloque).not.toContain("Proveedores:");
  });
});
