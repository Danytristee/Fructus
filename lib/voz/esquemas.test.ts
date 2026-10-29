import { describe, expect, it } from "vitest";

import { herramientasParaElModelo, leerInterpretacion } from "./esquemas";

describe("herramientasParaElModelo", () => {
  const herramientas = herramientasParaElModelo();

  it("son las 7 del diseño, en formato de función", () => {
    expect(herramientas.map((h) => h.function.name)).toEqual([
      "registrar_venta",
      "registrar_abono",
      "registrar_compra",
      "registrar_merma",
      "registrar_gasto",
      "consultar",
      "no_entendido",
    ]);
    expect(herramientas.every((h) => h.type === "function")).toBe(true);
  });

  it("la venta obliga a decir precio y condición, aunque sea null: el modelo no puede omitirlos", () => {
    const venta = herramientas[0]!.function.parameters as { required: string[]; properties: Record<string, unknown> };
    expect(venta.required).toEqual(expect.arrayContaining(["cliente_texto", "items", "condicion", "medio_pago"]));
    const item = (venta.properties.items as { items: { required: string[] } }).items;
    expect(item.required).toEqual(expect.arrayContaining(["producto_texto", "cantidad", "precio_unitario"]));
  });

  it("no le manda al modelo la versión del esquema", () => {
    expect(herramientas.some((h) => "$schema" in h.function.parameters)).toBe(false);
  });
});

describe("leerInterpretacion", () => {
  const venta = {
    cliente_texto: "don Lucho",
    items: [{ producto_texto: "mango kent", cantidad: 10, precio_unitario: null }],
    condicion: null,
    medio_pago: null,
  };

  it("acepta una venta sin precio ni condición, y completa lo que tiene valor por defecto", () => {
    const r = leerInterpretacion("registrar_venta", JSON.stringify(venta));
    expect(r.ok).toBe(true);
    if (r.ok && r.interpretacion.herramienta === "registrar_venta") {
      expect(r.interpretacion.datos.items[0]!.precio_unitario).toBeNull();
      expect(r.interpretacion.datos.condicion).toBeNull();
      expect(r.interpretacion.datos.comprobante).toBe("ninguno");
      expect(r.interpretacion.datos.dudas).toEqual([]);
    }
  });

  it("rechaza una venta que omite el precio en vez de decir null", () => {
    const sinPrecio = { ...venta, items: [{ producto_texto: "mango kent", cantidad: 10 }] };
    expect(leerInterpretacion("registrar_venta", sinPrecio).ok).toBe(false);
  });

  it("rechaza lo que no existe en el negocio: «fiado» no es una condición, ni −3 una cantidad", () => {
    expect(leerInterpretacion("registrar_venta", { ...venta, condicion: "fiado" }).ok).toBe(false);
    expect(leerInterpretacion("registrar_venta", { ...venta, items: [{ producto_texto: "mango", cantidad: -3, precio_unitario: 45 }] }).ok).toBe(false);
  });

  it("rechaza una herramienta inventada o argumentos que no son JSON", () => {
    expect(leerInterpretacion("borrar_todo", {}).ok).toBe(false);
    expect(leerInterpretacion("registrar_venta", "{no es json").ok).toBe(false);
  });

  it("un gasto sin medio de pago es en efectivo", () => {
    const r = leerInterpretacion("registrar_gasto", { categoria: "flete", monto: 80, descripcion: null });
    expect(r.ok && r.interpretacion.herramienta === "registrar_gasto" && r.interpretacion.datos.medio_pago).toBe("efectivo");
  });
});

describe("el prompt y el documento dicen lo mismo", () => {
  it("lib/voz/prompt.ts es el bloque de la sección 2 de docs/interprete-voz.md", async () => {
    const { readFileSync } = await import("node:fs");
    const { PROMPT_SISTEMA } = await import("./prompt");
    const doc = readFileSync("docs/interprete-voz.md", "utf8");
    const bloque = doc.split("## 2. Prompt de sistema del intérprete")[1]!.split("```text\n")[1]!.split("\n```")[0];
    expect(PROMPT_SISTEMA).toBe(bloque);
  });
});
