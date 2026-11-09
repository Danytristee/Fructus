import { describe, expect, it } from "vitest";

import { cronAutorizado } from "./cron";

const secreto = "un-secreto-largo-de-prueba-0123456789";

describe("cronAutorizado", () => {
  it("acepta lo que manda Vercel: «Bearer» y el secreto", () => {
    expect(cronAutorizado(`Bearer ${secreto}`, secreto)).toBe(true);
  });

  it("rechaza un pedido sin autorización, con otro secreto o con el secreto sin «Bearer»", () => {
    expect(cronAutorizado(null, secreto)).toBe(false);
    expect(cronAutorizado("", secreto)).toBe(false);
    expect(cronAutorizado("Bearer otro-secreto-largo-de-prueba-9876543210", secreto)).toBe(false);
    expect(cronAutorizado(secreto, secreto)).toBe(false);
    expect(cronAutorizado(`bearer ${secreto}`, secreto)).toBe(false);
    expect(cronAutorizado(`Bearer ${secreto} `, secreto)).toBe(false);
    expect(cronAutorizado(`Bearer ${secreto.slice(0, -1)}`, secreto)).toBe(false);
  });

  it("sin secreto configurado, o demasiado corto, nadie pasa: la ruta no se abre justo cuando falta la guarda", () => {
    expect(cronAutorizado("Bearer ", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado("Bearer abc", "abc")).toBe(false);
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
  });
});
