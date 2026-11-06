import { describe, expect, it } from "vitest";
import { permisosDe } from "./permisos-reglas";
import { estadoDelPerfil } from "./sesion-reglas";

describe("estadoDelPerfil", () => {
  it("con perfil activo, trae al perfil y lo que su rol puede hacer", () => {
    const perfil = { nombre: "Don Pedro", rol: "duenio" } as const;
    expect(estadoDelPerfil(perfil, false)).toEqual({ estado: "activo", perfil, permisos: permisosDe("duenio") });
  });

  it("el contador entra, pero solo lee", () => {
    const e = estadoDelPerfil({ nombre: "Rosa", rol: "contador" }, false);
    expect(e.estado).toBe("activo");
    expect(e.permisos).toEqual({ registrar: false, anular: false, ajustes: false, cierre: true });
  });

  it("sin error y sin fila, la cuenta no está activa y no puede nada", () => {
    expect(estadoDelPerfil(null, false)).toEqual({ estado: "inactivo", perfil: null, permisos: permisosDe(null) });
  });

  it("si la consulta falló, es una caída de conexión: nunca «cuenta inactiva» ni permisos vacíos", () => {
    const e = estadoDelPerfil(null, true);
    expect(e).toEqual({ estado: "sin-conexion", perfil: null, permisos: null });
    expect(e.estado).not.toBe("inactivo");
    // permisos null, no «nadie»: así una pantalla que olvide mirar el estado no esconde un botón en silencio.
    expect(e.permisos).toBeNull();
  });

  it("si la consulta falló, el error manda aunque llegara un perfil", () => {
    expect(estadoDelPerfil({ nombre: "Don Pedro", rol: "duenio" }, true).estado).toBe("sin-conexion");
  });
});
