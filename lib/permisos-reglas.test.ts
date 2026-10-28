import { describe, expect, it } from "vitest";
import { nombreDelRol, permisosDe } from "./permisos-reglas";

describe("permisosDe", () => {
  it("el dueño y el administrador pueden todo", () => {
    for (const rol of ["duenio", "administrador"] as const) {
      expect(permisosDe(rol)).toEqual({ registrar: true, anular: true, ajustes: true, cierre: true });
    }
  });

  it("el ayudante registra, pero no anula ni entra a Ajustes", () => {
    expect(permisosDe("ayudante")).toEqual({ registrar: true, anular: false, ajustes: false, cierre: true });
  });

  it("el contador solo lee: no registra, no anula, no entra a Ajustes", () => {
    expect(permisosDe("contador")).toEqual({ registrar: false, anular: false, ajustes: false, cierre: true });
  });

  it("una cuenta sin perfil activo no puede nada", () => {
    expect(permisosDe(null)).toEqual({ registrar: false, anular: false, ajustes: false, cierre: false });
  });
});

describe("nombreDelRol", () => {
  it("dice el rol como se lee en pantalla", () => {
    expect(nombreDelRol("duenio")).toBe("Dueño");
    expect(nombreDelRol("contador")).toBe("Contador");
  });
});
