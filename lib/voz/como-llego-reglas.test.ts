import { describe, expect, it } from "vitest";

import { sinEstadoQueEsNombre } from "./como-llego-reglas";

const item = (producto_texto: string, estado: "verde" | "pinton" | "maduro" | null) => ({ producto_texto, cantidad: 20, costo_unitario: 90, estado });
const estados = (frase: string, items: ReturnType<typeof item>[]) => sinEstadoQueEsNombre(frase, items).map((i) => i.estado);

describe("sinEstadoQueEsNombre", () => {
  // /voz-precision 2026-11-16: el modelo puso «manzana verde» en el nombre y además estado = "verde".
  it("«manzana verde» es el nombre de la fruta: no llegó verde", () => {
    expect(estados("Llegaron 20 cajas de manzana verde a 90", [item("manzana verde", "verde")])).toEqual([null]);
    expect(estados("Me trajeron 10 de plátano verde", [item("plátano verde", "verde")])).toEqual([null]);
  });

  it("si la palabra no está en el nombre, es cómo llegó", () => {
    expect(estados("Llegaron 30 cajas de mango kent verde a 32, lo pagué", [item("mango kent", "verde")])).toEqual(["verde"]);
    expect(estados("El de Chao me trajo 15 de papaya madura a 28", [item("papaya", "maduro")])).toEqual(["maduro"]);
    expect(estados("Llegaron 8 de palta pintona", [item("palta", "pinton")])).toEqual(["pinton"]);
  });

  it("si la dijo dos veces, una es el nombre y la otra cómo llegó", () => {
    expect(estados("Llegaron 10 de plátano verde, llegó verde", [item("plátano verde", "verde")])).toEqual(["verde"]);
  });

  it("con dos frutas, la palabra que sobra es de la que no la lleva en el nombre", () => {
    const frase = "Llegaron 20 de manzana verde y 10 de mango kent verde";
    expect(estados(frase, [item("manzana verde", "verde"), item("mango kent", "verde")])).toEqual([null, "verde"]);
  });

  it("no toca lo que el modelo dejó sin estado ni cambia lo demás del ítem", () => {
    const items = [item("manzana verde", null), item("mango", null)];
    expect(sinEstadoQueEsNombre("Llegaron 20 de manzana verde y 5 de mango", items)).toEqual(items);
  });
});
