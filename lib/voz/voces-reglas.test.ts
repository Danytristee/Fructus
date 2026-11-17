import { describe, expect, it } from "vitest";

import { elegirVoz, etiquetaVoz, vocesEnEspanol, type Voz } from "./voces-reglas";

const voz = (nombre: string, lang: string, local = true, uri = nombre): Voz => ({ uri, nombre, lang, local });

describe("vocesEnEspanol", () => {
  it("deja solo las de español, primero las de Perú y Latinoamérica, España al final", () => {
    const voces = [voz("Samantha", "en-US"), voz("Mónica", "es-ES"), voz("Paulina", "es-MX"), voz("Juan", "es_US"), voz("Ana", "es-PE")];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["Ana", "Juan", "Paulina", "Mónica"]);
  });

  // Tiene que sonar al instante y sin señal: la del celular gana a la de internet aunque esa suene mejor.
  it("dentro del mismo país, primero la que no necesita internet, y entre esas, la de mejor calidad", () => {
    const voces = [
      voz("Google español de Estados Unidos", "es-US", false),
      voz("Paulina", "es-MX"),
      voz("Paulina (Mejorada)", "es-MX"),
      voz("es-us-x-sfb-network", "es-US", false),
      voz("es-us-x-sfb-local", "es-US", true),
    ];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual([
      "es-us-x-sfb-local",
      "Google español de Estados Unidos",
      "es-us-x-sfb-network",
      "Paulina (Mejorada)",
      "Paulina",
    ]);
  });

  it("las voces de personaje de Apple (Eddy, Grandma…) van al final de su país: suenan a robot", () => {
    const voces = [voz("Eddy (español (México))", "es-MX"), voz("Grandma (español (México))", "es-MX"), voz("Paulina", "es-MX")];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["Paulina", "Eddy (español (México))", "Grandma (español (México))"]);
  });

  it("sin voces en español, ninguna", () => {
    expect(vocesEnEspanol([voz("Samantha", "en-US")])).toEqual([]);
  });
});

describe("elegirVoz", () => {
  const voces = [voz("Paulina", "es-MX"), voz("Mónica", "es-ES"), voz("Juan", "es-US")];

  it("la que eligió la persona en este celular manda", () => {
    expect(elegirVoz(voces, "Mónica")?.nombre).toBe("Mónica");
  });

  it("si la elegida ya no está (otro celular, se desinstaló), la mejor que haya", () => {
    expect(elegirVoz(voces, "Ya no existe")?.nombre).toBe("Juan");
    expect(elegirVoz(voces, null)?.nombre).toBe("Juan");
  });

  it("no elige una voz en inglés aunque se haya guardado", () => {
    expect(elegirVoz([voz("Samantha", "en-US"), ...voces], "Samantha")?.nombre).toBe("Juan");
  });

  it("sin voces en español, ninguna: el navegador usa la suya con el idioma es-PE", () => {
    expect(elegirVoz([voz("Samantha", "en-US")], null)).toBeUndefined();
  });
});

describe("etiquetaVoz", () => {
  it("el nombre sin la marca y el país en palabras", () => {
    expect(etiquetaVoz(voz("Microsoft Sabina - Spanish (Mexico)", "es-MX"))).toEqual({ nombre: "Sabina", detalle: "México" });
    expect(etiquetaVoz(voz("Paulina (Enhanced)", "es-MX"))).toEqual({ nombre: "Paulina", detalle: "México · mejorada" });
    expect(etiquetaVoz(voz("Eddy (español (México))", "es-MX"))).toEqual({ nombre: "Eddy", detalle: "México" });
  });

  it("la de Google, que no tiene nombre propio, se llama por su país", () => {
    expect(etiquetaVoz(voz("Google español de Estados Unidos", "es-US", false))).toEqual({
      nombre: "Google",
      detalle: "Estados Unidos · necesita internet",
    });
  });

  it("los códigos de Android se dicen como «Voz» y sus letras", () => {
    expect(etiquetaVoz(voz("es-us-x-sfb-local", "es-US"))).toEqual({ nombre: "Voz SFB", detalle: "Estados Unidos" });
    expect(etiquetaVoz(voz("es-us-x-esd-network", "es-US", false))).toEqual({ nombre: "Voz ESD", detalle: "Estados Unidos · necesita internet" });
  });

  it("un país que no está en la lista dice «español»", () => {
    expect(etiquetaVoz(voz("Pepe", "es-GT")).detalle).toBe("Español");
  });
});
