import { describe, expect, it, vi } from "vitest";
import { cuentasGroq, otraCuentaAyuda, probarEnOrden, type Pedido, type Proveedor } from "./respaldo-reglas";

const bien = (valor: string): Pedido<string> => ({ ok: true, valor });
const mal = (error: string, estado?: number): Pedido<string> => ({ ok: false, error, estado });

/** Groq con la principal, Groq con la de respaldo y Gemini, cada uno con lo que responderá. */
function tres(principal: Pedido<string>, respaldo: Pedido<string>, gemini: Pedido<string>, claves = { p: "gsk_1", r: "gsk_2", g: "AIza" }) {
  const pedir = { principal: vi.fn(async () => principal), respaldo: vi.fn(async () => respaldo), gemini: vi.fn(async () => gemini) };
  const proveedores: Proveedor<string>[] = [
    { servicio: "groq", modelo: "whisper", cuenta: "principal", clave: claves.p, pedir: pedir.principal },
    { servicio: "groq", modelo: "whisper", cuenta: "respaldo", clave: claves.r, pedir: pedir.respaldo },
    { servicio: "gemini", modelo: "gemini-flash", clave: claves.g, pedir: pedir.gemini },
  ];
  return { proveedores, pedir };
}

describe("cuentasGroq", () => {
  it("sin respaldo, solo la principal", () => {
    expect(cuentasGroq("gsk_1", undefined)).toEqual([{ cuenta: "principal", clave: "gsk_1" }]);
    expect(cuentasGroq("gsk_1", "")).toEqual([{ cuenta: "principal", clave: "gsk_1" }]);
    expect(cuentasGroq("gsk_1", "   ")).toEqual([{ cuenta: "principal", clave: "gsk_1" }]);
  });

  it("con respaldo, la principal primero", () => {
    expect(cuentasGroq("gsk_1", "gsk_2")).toEqual([
      { cuenta: "principal", clave: "gsk_1" },
      { cuenta: "respaldo", clave: "gsk_2" },
    ]);
  });

  it("la misma clave dos veces cuenta una sola", () => {
    expect(cuentasGroq("gsk_1", "gsk_1")).toEqual([{ cuenta: "principal", clave: "gsk_1" }]);
    expect(cuentasGroq("gsk_1", " gsk_1 \n")).toEqual([{ cuenta: "principal", clave: "gsk_1" }]);
  });

  it("si solo está la de respaldo, la principal queda sin clave y responde la de respaldo", () => {
    expect(cuentasGroq(undefined, "gsk_2")).toEqual([
      { cuenta: "principal", clave: undefined },
      { cuenta: "respaldo", clave: "gsk_2" },
    ]);
  });
});

describe("otraCuentaAyuda", () => {
  it("sí, cuando la cuenta se quedó sin cupo o su clave no vale", () => {
    for (const estado of [429, 401, 403]) expect(otraCuentaAyuda(estado)).toBe(true);
  });

  it("no, cuando Groq no respondió, se cayó o la pregunta no sirve", () => {
    for (const estado of [undefined, 400, 404, 413, 500, 502, 503]) expect(otraCuentaAyuda(estado)).toBe(false);
  });
});

describe("probarEnOrden", () => {
  it("responde la principal y no se toca nada más", async () => {
    const { proveedores, pedir } = tres(bien("vendí cinco"), bien("x"), bien("x"));
    const r = await probarEnOrden(proveedores, () => {});
    expect(r).toEqual({ ok: true, valor: "vendí cinco", modelo: "whisper", intentos: [] });
    expect(pedir.respaldo).not.toHaveBeenCalled();
    expect(pedir.gemini).not.toHaveBeenCalled();
  });

  it("principal sin cupo (429) → responde la de respaldo, con su clave", async () => {
    const { proveedores, pedir } = tres(mal("HTTP 429 (límite del plan gratuito)", 429), bien("vendí cinco"), bien("x"));
    const avisar = vi.fn();
    const r = await probarEnOrden(proveedores, avisar);
    expect(r.ok && r.valor).toBe("vendí cinco");
    expect(pedir.respaldo).toHaveBeenCalledWith("gsk_2");
    expect(pedir.gemini).not.toHaveBeenCalled();
    expect(r.intentos).toEqual([{ modelo: "whisper", cuenta: "principal", error: "HTTP 429 (límite del plan gratuito)" }]);
    expect(avisar).toHaveBeenCalledOnce();
  });

  it("principal rechazada (401) → responde la de respaldo", async () => {
    const { proveedores, pedir } = tres(mal("HTTP 401", 401), bien("vendí cinco"), bien("x"));
    expect((await probarEnOrden(proveedores, () => {})).ok).toBe(true);
    expect(pedir.respaldo).toHaveBeenCalledOnce();
  });

  it("Groq no respondió en 8 s → no se espera otra vez con la otra cuenta: va directo a Gemini", async () => {
    const { proveedores, pedir } = tres(mal("no respondió en 8 s"), bien("x"), bien("vendí cinco"));
    const r = await probarEnOrden(proveedores, () => {});
    expect(r.ok && r.valor).toBe("vendí cinco");
    expect(r.ok && r.modelo).toBe("gemini-flash");
    expect(pedir.respaldo).not.toHaveBeenCalled();
  });

  it("Groq caído (503) o respuesta inválida → directo a Gemini", async () => {
    for (const falla of [mal("HTTP 503", 503), mal("respuesta inválida: falta items")]) {
      const { proveedores, pedir } = tres(falla, bien("x"), bien("vendí cinco"));
      expect((await probarEnOrden(proveedores, () => {})).ok).toBe(true);
      expect(pedir.respaldo).not.toHaveBeenCalled();
      expect(pedir.gemini).toHaveBeenCalledOnce();
    }
  });

  it("las dos cuentas sin cupo → Gemini, y quedan los dos 429 anotados", async () => {
    const { proveedores } = tres(mal("HTTP 429", 429), mal("HTTP 429", 429), bien("vendí cinco"));
    const r = await probarEnOrden(proveedores, () => {});
    expect(r.ok && r.modelo).toBe("gemini-flash");
    expect(r.intentos.map((i) => i.cuenta)).toEqual(["principal", "respaldo"]);
  });

  it("todo falla → no inventa nada y devuelve cada intento", async () => {
    const { proveedores } = tres(mal("HTTP 429", 429), mal("no respondió en 8 s"), mal("HTTP 500", 500));
    const r = await probarEnOrden(proveedores, () => {});
    expect(r.ok).toBe(false);
    expect(r.intentos.map((i) => i.error)).toEqual(["HTTP 429", "no respondió en 8 s", "HTTP 500"]);
  });

  it("sin clave principal, la de respaldo responde y la falta queda anotada", async () => {
    const { proveedores, pedir } = tres(bien("x"), bien("vendí cinco"), bien("x"), { p: "", r: "gsk_2", g: "" });
    const r = await probarEnOrden(proveedores, () => {});
    expect(r.ok && r.valor).toBe("vendí cinco");
    expect(pedir.principal).not.toHaveBeenCalled();
    expect(r.intentos).toEqual([{ modelo: "whisper", cuenta: "principal", error: "sin clave configurada" }]);
  });

  it("Gemini sin clave → se anota y no se llama", async () => {
    const { proveedores, pedir } = tres(mal("HTTP 429", 429), mal("HTTP 429", 429), bien("x"), { p: "gsk_1", r: "gsk_2", g: "" });
    const r = await probarEnOrden(proveedores, () => {});
    expect(r.ok).toBe(false);
    expect(pedir.gemini).not.toHaveBeenCalled();
    expect(r.intentos.at(-1)).toEqual({ modelo: "gemini-flash", error: "sin clave configurada" });
  });

  // ADR-0026: el intérprete pregunta primero a Claude. Si falla, por lo que sea, Groq sigue: es otra empresa.
  it("Claude primero; si se queda sin cupo o no responde, contesta Groq con su principal", async () => {
    for (const falla of [mal("HTTP 429 (sin cupo)", 429), mal("no respondió en 8 s")]) {
      const { proveedores, pedir } = tres(bien("venta de Groq"), bien("x"), bien("x"));
      const claude = vi.fn(async () => falla);
      const r = await probarEnOrden([{ servicio: "anthropic", modelo: "claude-haiku-5-5", clave: "sk-ant", pedir: claude }, ...proveedores], () => {});
      expect(r.ok && r.valor).toBe("venta de Groq");
      expect(r.ok && r.modelo).toBe("whisper");
      expect(pedir.respaldo).not.toHaveBeenCalled();
    }
  });

  it("sin clave de Anthropic se anota y Groq sigue como siempre", async () => {
    const { proveedores } = tres(bien("venta de Groq"), bien("x"), bien("x"));
    const r = await probarEnOrden([{ servicio: "anthropic", modelo: "claude-haiku-5-5", clave: undefined, pedir: vi.fn() }, ...proveedores], () => {});
    expect(r.ok && r.valor).toBe("venta de Groq");
    expect(r.intentos).toEqual([{ modelo: "claude-haiku-5-5", error: "sin clave configurada" }]);
  });
});
