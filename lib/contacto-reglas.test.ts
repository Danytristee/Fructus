import { describe, expect, it } from "vitest";

import { enlaceDeLlamada, enlaceWhatsApp, mensajeAlCliente } from "./contacto-reglas";

describe("enlaceDeLlamada", () => {
  it("arma el enlace con solo los dígitos", () => {
    expect(enlaceDeLlamada("987 654 321")).toBe("tel:987654321");
    expect(enlaceDeLlamada("+51 987-654-321")).toBe("tel:+51987654321");
    expect(enlaceDeLlamada("(044) 234567")).toBe("tel:044234567");
  });

  it("no inventa un enlace con lo que no es un teléfono", () => {
    expect(enlaceDeLlamada(null)).toBeNull();
    expect(enlaceDeLlamada("")).toBeNull();
    expect(enlaceDeLlamada("llamar a la tarde")).toBeNull();
    expect(enlaceDeLlamada("123")).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("completa el 51 de un celular peruano y respeta el código de país", () => {
    expect(enlaceWhatsApp("987 654 321")).toBe("https://wa.me/51987654321");
    expect(enlaceWhatsApp("+51 987-654-321")).toBe("https://wa.me/51987654321");
    expect(enlaceWhatsApp("51987654321")).toBe("https://wa.me/51987654321");
  });
  it("lleva el mensaje escrito, listo para que la persona lo mande", () => {
    expect(enlaceWhatsApp("987654321", "Hola, ¿a cómo el kiwi?")).toBe("https://wa.me/51987654321?text=Hola%2C%20%C2%BFa%20c%C3%B3mo%20el%20kiwi%3F");
  });
  it("un fijo o un número con letras no abre WhatsApp", () => {
    expect(enlaceWhatsApp("044 123456")).toBeNull();
    expect(enlaceWhatsApp("llamar a Hugo")).toBeNull();
    expect(enlaceWhatsApp(null)).toBeNull();
  });
});

describe("mensajeAlCliente", () => {
  it("si debe, le recuerda cuánto, por su apodo", () => {
    expect(mensajeAlCliente({ nombre: "Luis Paredes", apodo: "don Lucho", saldo: 230 })).toBe(
      "Hola don Lucho, ¿cómo estás? Te escribo por tu cuenta del puesto: van S/\u00a0230.00. ¿Cuándo pasas a abonar?",
    );
  });

  it("sin apodo, por su nombre", () => {
    expect(mensajeAlCliente({ nombre: "Bodega Santa Ana", apodo: null, saldo: 10 })).toMatch(/^Hola Bodega Santa Ana, /);
    expect(mensajeAlCliente({ nombre: "Rosa Quispe", apodo: "  ", saldo: 0 })).toBe("Hola Rosa Quispe, ¿cómo estás?");
  });

  it("si está al día o tiene a favor, solo lo saluda", () => {
    expect(mensajeAlCliente({ nombre: "Rosa Quispe", saldo: 0 })).toBe("Hola Rosa Quispe, ¿cómo estás?");
    expect(mensajeAlCliente({ nombre: "Rosa Quispe", saldo: -20 })).toBe("Hola Rosa Quispe, ¿cómo estás?");
    // un resto de redondeo no es deuda
    expect(mensajeAlCliente({ nombre: "Rosa", saldo: 0.001 })).toBe("Hola Rosa, ¿cómo estás?");
  });

  it("con miles, el monto como en toda la app", () => {
    expect(mensajeAlCliente({ nombre: "Bodega Santa Ana", saldo: 1250.5 })).toContain("S/\u00a01,250.50");
  });
});
