import { describe, expect, it } from "vitest";

import { elegirVoz, etiquetarVoces, vocesEnEspanol, type Voz } from "./voces-reglas";

const voz = (nombre: string, lang: string, local = true, uri = nombre): Voz => ({ uri, nombre, lang, local });

describe("vocesEnEspanol", () => {
  it("deja solo las de español, primero las de Perú y Latinoamérica, España al final", () => {
    const voces = [voz("Samantha", "en-US"), voz("Mónica", "es-ES"), voz("Paulina", "es-MX"), voz("Juan", "es_US"), voz("Ana", "es-PE")];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["Ana", "Juan", "Paulina", "Mónica"]);
  });

  it("dentro del mismo país, la de mejor calidad primero", () => {
    const voces = [voz("Paulina", "es-MX"), voz("Paulina (Mejorada)", "es-MX")];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["Paulina (Mejorada)", "Paulina"]);
  });

  // Tiene que sonar al instante y sin señal: las de internet tardan en empezar y sin señal se quedan calladas (/formidable 2026-11-17).
  it("deja fuera las que necesitan internet si hay alguna sin internet", () => {
    const voces = [
      voz("Google español de Estados Unidos", "es-US", false),
      voz("es-us-x-sfb-network", "es-US", false),
      voz("es-us-x-sfb-local", "es-US"),
      voz("Paulina", "es-MX"),
    ];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["es-us-x-sfb-local", "Paulina"]);
  });

  it("si solo hay voces de internet, las usa: es mejor que no hablar", () => {
    const voces = [voz("Google español", "es-ES", false), voz("Google español de Estados Unidos", "es-US", false)];
    expect(vocesEnEspanol(voces).map((v) => v.nombre)).toEqual(["Google español de Estados Unidos", "Google español"]);
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

describe("etiquetarVoces", () => {
  const una = (v: Voz) => etiquetarVoces([v])[0];

  it("el nombre sin la marca y el país en palabras", () => {
    expect(una(voz("Microsoft Sabina - Spanish (Mexico)", "es-MX"))).toMatchObject({ nombre: "Sabina", detalle: "México" });
    expect(una(voz("Paulina (Enhanced)", "es-MX"))).toMatchObject({ nombre: "Paulina", detalle: "México · mejorada" });
    expect(una(voz("Eddy (español (México))", "es-MX"))).toMatchObject({ nombre: "Eddy", detalle: "México" });
  });

  // El ciego creía que «Estados Unidos» era la razón de que sonara a gringo: es el español latino neutro de Google.
  it("el español de Estados Unidos se dice «Latinoamérica»", () => {
    expect(una(voz("Google español de Estados Unidos", "es-US", false))).toMatchObject({
      nombre: "Google",
      detalle: "Latinoamérica · necesita internet",
    });
  });

  it("los códigos de Android se numeran en el orden de la lista; los nombres propios se quedan", () => {
    const voces = [voz("es-us-x-sfb-local", "es-US"), voz("Paulina", "es-MX"), voz("es-us-x-esd-local", "es-US"), voz("es-es-x-eea-local", "es-ES")];
    expect(etiquetarVoces(voces).map((o) => `${o.nombre} · ${o.detalle}`)).toEqual([
      "Voz 1 · Latinoamérica",
      "Paulina · México",
      "Voz 2 · Latinoamérica",
      "Voz 3 · España",
    ]);
  });

  it("guarda la voz original, para elegirla y hacerla hablar", () => {
    const v = voz("es-us-x-sfb-local", "es-US", true, "uri-sfb");
    expect(una(v)?.voz).toBe(v);
  });

  it("un país que no está en la lista dice «español»", () => {
    expect(una(voz("Pepe", "es-GT"))?.detalle).toBe("Español");
  });
});
