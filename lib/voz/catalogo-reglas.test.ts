import { describe, expect, it } from "vitest";

import { bloqueCatalogo } from "./catalogo-reglas";

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
