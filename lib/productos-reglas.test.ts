import { describe, expect, it } from "vitest";

import { agruparPorFruta, compararProductos, detalleProducto, nombreProducto, rangoSeleccion, tituloEnGrupo, tituloProducto, type PartesProducto } from "./productos-reglas";

// Con espacios normales, para leer las pruebas: la regla usa espacio duro en «cal. 113» y «18 kg».
const plano = (s: string) => s.replace(/\u00a0/g, " ");
const p = (nombre: string, variedad: string | null, extra: Partial<PartesProducto> = {}): PartesProducto => ({ nombre, variedad, ...extra });

describe("nombre del producto", () => {
  it("el título junta fruta, variedad y selección", () => {
    expect(tituloProducto(p("Manzana", "Verde", { marca: "Nordic", seleccion: "Premium", calibre: "100" }))).toBe("Manzana Verde Premium");
    expect(tituloProducto(p("Membrillo", null, { seleccion: "4ta" }))).toBe("Membrillo 4ta");
    expect(tituloProducto(p("Piña", null))).toBe("Piña");
  });

  it("dentro del grupo de su fruta no la repite, y si no tiene más, es la fruta", () => {
    expect(tituloEnGrupo(p("Manzana", "Verde", { seleccion: "Premium" }))).toBe("Verde Premium");
    expect(tituloEnGrupo(p("Ciruela", "chilena Fortuna"))).toBe("Chilena Fortuna");
    expect(tituloEnGrupo(p("Membrillo", null, { seleccion: "4ta" }))).toBe("4ta");
    expect(tituloEnGrupo(p("Piña", null))).toBe("Piña");
  });

  it("en una frase lleva el calibre, para que dos calibres no se confundan", () => {
    const a = p("Manzana", "Roja americana", { seleccion: "Premium", calibre: "113" });
    const b = p("Manzana", "Roja americana", { seleccion: "Premium", calibre: "100" });
    expect(plano(nombreProducto(a))).toBe("Manzana Roja americana Premium cal. 113");
    expect(nombreProducto(a)).not.toBe(nombreProducto(b));
  });

  it("un producto de los de antes, sin las partes nuevas, se nombra igual que siempre", () => {
    expect(nombreProducto(p("Mango", "Kent"))).toBe("Mango Kent");
  });

  it("el detalle dice marca, calibre y kilos; vacío si no hay nada", () => {
    expect(plano(detalleProducto(p("Manzana", "Verde", { marca: "Nordic", calibre: "80 o 75", kgPorCaja: 18 })))).toBe("Nordic · cal. 80 o 75 · 18 kg");
    expect(detalleProducto(p("Tumbo", null))).toBe("");
  });
});

describe("orden del catálogo", () => {
  it("la selección va de la mejor a la de menos, con Comercial al final", () => {
    const orden = ["Comercial", "2da", "Super", "1era", "Extra", "Premium", "4ta"].sort((a, b) => rangoSeleccion(a) - rangoSeleccion(b));
    expect(orden).toEqual(["Super", "Premium", "Extra", "1era", "2da", "4ta", "Comercial"]);
  });

  it("acepta cómo se escribe en el puesto: 3era, 3ra o tercera", () => {
    expect(rangoSeleccion("3era")).toBe(rangoSeleccion("3ra"));
    expect(rangoSeleccion("Tercera")).toBe(rangoSeleccion("3ra"));
  });

  it("una selección desconocida no rompe el orden: va al final", () => {
    expect(rangoSeleccion("Selecta")).toBeGreaterThan(rangoSeleccion("Comercial"));
  });

  it("ordena fruta → variedad → selección → calibre, sin mirar tildes ni mayúsculas", () => {
    const lista = [
      p("Pera", "Gaucho", { seleccion: "Elegido" }),
      p("Manzana", "Verde", { seleccion: "Comercial" }),
      p("manzana", "Roja americana", { seleccion: "Premium", calibre: "113" }),
      p("Albaricoque", null, { seleccion: "2da" }),
      p("Manzana", "Verde", { seleccion: "Premium" }),
      p("Manzana", "Roja americana", { seleccion: "Premium", calibre: "100" }),
      p("Pera", "Gaucho", { seleccion: "Premium" }),
    ].sort(compararProductos);
    expect(lista.map((x) => plano(nombreProducto(x)))).toEqual([
      "Albaricoque 2da",
      "Manzana Roja americana Premium cal. 100",
      "manzana Roja americana Premium cal. 113",
      "Manzana Verde Premium",
      "Manzana Verde Comercial",
      "Pera Gaucho Premium",
      "Pera Gaucho Elegido",
    ]);
  });

  it("agrupa por fruta, aunque una venga sin tilde", () => {
    const grupos = agruparPorFruta([p("Platano", "bizcocho orgánico"), p("Piña", null), p("Plátano", "bizcocho")]);
    expect(grupos.map((g) => [g.fruta, g.productos.length])).toEqual([
      ["Piña", 1],
      ["Plátano", 2],
    ]);
  });
});
