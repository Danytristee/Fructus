import { describe, expect, it } from "vitest";

import {
  agregarApodo,
  avisoParecidos,
  BORRADOR_VACIO,
  borradorDeCliente,
  hayCambios,
  leerDocumento,
  leerTelefono,
  limpiarApodo,
  mismaFila,
  primeraFalta,
  validarCliente,
  type BorradorCliente,
} from "./cliente-reglas";

const lucho: BorradorCliente = { ...BORRADOR_VACIO, nombre: "Luis Paredes", alias: ["don lucho"], tipoDocumento: "DNI", numeroDocumento: "40123456" };

describe("apodos", () => {
  it("se guardan en minúscula, sin comillas ni espacios de más", () => {
    expect(limpiarApodo("  «Don   Lucho»  ")).toBe("don lucho");
    expect(agregarApodo([], "Don Lucho")).toEqual({ ok: true, lista: ["don lucho"] });
  });

  it("vacío no es error (no hay nada que agregar); repetido, largo o de más sí", () => {
    expect(agregarApodo(["lucho"], "   ")).toEqual({ ok: false, error: null });
    expect(agregarApodo(["lucho"], "LUCHO")).toEqual({ ok: false, error: "Ese apodo ya está." });
    expect(agregarApodo([], "x".repeat(41))).toMatchObject({ ok: false });
    const ocho = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(agregarApodo(ocho, "i")).toEqual({ ok: false, error: "Con 8 apodos alcanza." });
  });
});

describe("leerDocumento", () => {
  it("DNI de 8 números y RUC de 11 que empieza con 10, 15, 16, 17 o 20", () => {
    expect(leerDocumento("DNI", "40123456")).toEqual({ ok: true, numero: "40123456" });
    expect(leerDocumento("DNI", "401 234-56")).toEqual({ ok: true, numero: "40123456" });
    for (const ruc of ["20601234567", "10456789012", "15000000001", "17000000001"]) {
      expect(leerDocumento("RUC", ruc), ruc).toEqual({ ok: true, numero: ruc });
    }
  });

  it("rechaza lo que la base rechazaría, con una frase de puesto", () => {
    expect(leerDocumento("DNI", "1234567")).toEqual({ ok: false, error: "El DNI tiene 8 números." });
    expect(leerDocumento("DNI", "1234567a")).toMatchObject({ ok: false });
    expect(leerDocumento("RUC", "30601234567")).toEqual({ ok: false, error: "El RUC tiene 11 números y empieza con 10 o 20." });
    expect(leerDocumento("RUC", "2060123456")).toMatchObject({ ok: false });
    expect(leerDocumento("RUC", "")).toEqual({ ok: false, error: "Escribe el RUC: son 11 números." });
  });

  it("sin tipo no hay número: un número suelto pide elegir el tipo", () => {
    expect(leerDocumento(null, "")).toEqual({ ok: true, numero: null });
    expect(leerDocumento(null, "40123456")).toEqual({ ok: false, error: "Elige si es DNI o RUC." });
  });
});

describe("leerTelefono", () => {
  it("acepta números con espacios, guiones, + y paréntesis; vacío es null", () => {
    expect(leerTelefono("987 654 321")).toEqual({ ok: true, telefono: "987 654 321" });
    expect(leerTelefono("+51 987-654-321")).toEqual({ ok: true, telefono: "+51 987-654-321" });
    expect(leerTelefono("(044) 234567")).toEqual({ ok: true, telefono: "(044) 234567" });
    expect(leerTelefono("  ")).toEqual({ ok: true, telefono: null });
  });

  it("rechaza letras, muy pocos números y demasiado largos", () => {
    for (const malo of ["llamar tarde", "12345", "9876543210123456", "987 654 321 ext 5 y mas texto"]) {
      expect(leerTelefono(malo), malo).toMatchObject({ ok: false });
    }
  });
});

describe("validarCliente", () => {
  it("limpia y deja null lo que no se llenó", () => {
    const v = validarCliente({ ...lucho, nombre: "  Luis   Paredes ", alias: ["Don Lucho", "don lucho", "LUCHO", "  "], direccion: "  ", notas: "" });
    expect(v).toEqual({
      ok: true,
      fila: { nombre: "Luis Paredes", alias: ["don lucho", "lucho"], tipo_documento: "DNI", numero_documento: "40123456", telefono: null, direccion: null, notas: null },
    });
  });

  it("sin nombre no hay cliente; lo demás es opcional", () => {
    expect(validarCliente(BORRADOR_VACIO)).toEqual({ ok: false, errores: { nombre: "Escribe cómo se llama." } });
    expect(validarCliente({ ...BORRADOR_VACIO, nombre: "Rosa Quispe" }).ok).toBe(true);
  });

  it("junta todos los errores, uno por campo", () => {
    const v = validarCliente({ ...BORRADOR_VACIO, nombre: "x".repeat(81), telefono: "abc", tipoDocumento: "DNI", numeroDocumento: "12", direccion: "d".repeat(121), notas: "n".repeat(301) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.errores).sort()).toEqual(["direccion", "documento", "nombre", "notas", "telefono"]);
  });

  it("primeraFalta dice una sola cosa, en el orden de la hoja", () => {
    expect(primeraFalta(BORRADOR_VACIO)).toBe("Escribe cómo se llama.");
    expect(primeraFalta({ ...BORRADOR_VACIO, nombre: "Rosa", tipoDocumento: "RUC", numeroDocumento: "1" })).toBe("El RUC tiene 11 números y empieza con 10 o 20.");
    expect(primeraFalta(lucho)).toBeNull();
  });
});

describe("editar", () => {
  const fila = { nombre: "Luis Paredes", alias: ["don lucho", "lucho"], tipo_documento: "DNI", numero_documento: "40123456", telefono: null, direccion: null, notas: null };

  it("de la base al borrador y de vuelta, sin cambios", () => {
    const b = borradorDeCliente(fila);
    expect(b).toMatchObject({ nombre: "Luis Paredes", tipoDocumento: "DNI", numeroDocumento: "40123456", telefono: "", direccion: "" });
    expect(hayCambios(b, b)).toBe(false);
    expect(hayCambios(b, { ...b, nombre: "  Luis  Paredes " })).toBe(false);
  });

  it("agregar un apodo o un teléfono es un cambio", () => {
    const b = borradorDeCliente(fila);
    expect(hayCambios(b, { ...b, alias: [...b.alias, "don luis"] })).toBe(true);
    expect(hayCambios(b, { ...b, telefono: "987 654 321" })).toBe(true);
  });

  it("un tipo de documento que no es DNI ni RUC se ignora, no se inventa", () => {
    expect(borradorDeCliente({ ...fila, tipo_documento: "CE", numero_documento: "123" }).tipoDocumento).toBeNull();
  });
});

describe("mismaFila", () => {
  const a = validarCliente(lucho);
  it("el mismo cliente reintentado es el mismo, aunque cambie la mayúscula del nombre", () => {
    if (!a.ok) throw new Error("el caso base debe ser válido");
    expect(mismaFila(a.fila, { ...a.fila, nombre: "LUIS PAREDES" })).toBe(true);
  });

  it("con otro teléfono, otro documento o otros apodos es otro cliente que se llama igual", () => {
    if (!a.ok) throw new Error("el caso base debe ser válido");
    expect(mismaFila(a.fila, { ...a.fila, telefono: "987 654 321" })).toBe(false);
    expect(mismaFila(a.fila, { ...a.fila, numero_documento: "40123457" })).toBe(false);
    expect(mismaFila(a.fila, { ...a.fila, alias: [] })).toBe(false);
  });
});

describe("avisoParecidos", () => {
  it("dice a quién se parece, con su apodo si lo tiene", () => {
    expect(avisoParecidos([{ nombre: "Luis Paredes", alias: ["don lucho"] }])).toBe("Ya tienes a Luis Paredes («don lucho»). ¿Es el mismo?");
    expect(avisoParecidos([{ nombre: "Rosa Quispe", alias: [] }, { nombre: "Rosa Quispe Díaz", alias: [] }, { nombre: "Otra", alias: [] }])).toBe(
      "Ya tienes a Rosa Quispe y a Rosa Quispe Díaz. ¿Es el mismo?",
    );
  });

  it("sin parecidos no dice nada", () => {
    expect(avisoParecidos([])).toBeNull();
  });
});
