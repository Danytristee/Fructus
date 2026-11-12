import { describe, expect, it } from "vitest";

import { formatearCajas, formatearSoles } from "./formato";
import { contarPorEnviar, desenlaceConfirmacion, esperaTras, franjaDe, resumenDe, siguiente, SIN_SENAL, type Entrada, type Operacion, type Situacion } from "./cola-reglas";

const venta: Operacion = {
  tipo: "venta",
  entrada: {
    comandoId: 7,
    corregido: false,
    latenciaMs: 900,
    borrador: {
      cliente: { id: 1, nombre: "Don Lucho" },
      items: [{ productoId: 3, producto: "Mango", cantidad: 3, precio: 40, sugerido: false }],
      descuento: 0,
      condicion: "credito",
      medio: null,
    },
  },
};
const abono: Operacion = {
  tipo: "abono",
  entrada: { comandoId: 8, corregido: false, latenciaMs: 0, borrador: { cliente: { id: 1, nombre: "Don Lucho" }, monto: 80, medio: "efectivo" } },
};

let n = 0;
function entrada(parcial: Partial<Entrada> & Pick<Entrada, "contenido">): Entrada {
  n += 1;
  return { id: n, usuarioId: "dueno", creadoEn: 0, estado: "pendiente", resumen: "x", ...parcial };
}
const conf = (op: Operacion, p: Partial<Entrada> = {}) => entrada({ contenido: { clase: "confirmacion", operacion: op }, ...p });
const audio = (p: Partial<Entrada> = {}) => entrada({ contenido: { clase: "audio", audio: new Blob(), duracionMs: 2000 }, ...p });

describe("desenlaceConfirmacion", () => {
  it("guardado → hecho", () => expect(desenlaceConfirmacion({ ok: true })).toEqual({ tipo: "hecho" }));
  it("la base no respondió → se reintenta, no es un rechazo", () => expect(desenlaceConfirmacion({ ok: false, error: SIN_SENAL })).toEqual({ tipo: "reintentar" }));
  it("sesión vencida → espera a que entre", () => expect(desenlaceConfirmacion({ ok: false, error: "Tu sesión terminó.", sinSesion: true })).toEqual({ tipo: "sin_sesion" }));
  it("cualquier otro error → rechazo con su frase", () =>
    expect(desenlaceConfirmacion({ ok: false, error: "Ese cliente ya no está en tu cuaderno. Elige a otro." })).toEqual({
      tipo: "rechazo",
      error: "Ese cliente ya no está en tu cuaderno. Elige a otro.",
    }));
});

describe("siguiente", () => {
  it("va en el orden en que se guardó, aunque lleguen desordenadas", () => {
    const a = conf(venta);
    const b = conf(abono);
    expect(siguiente([b, a], "dueno")).toBe(a);
  });

  it("se salta lo que espera a la persona (tarjetas por confirmar)", () => {
    const t = entrada({ contenido: { clase: "por_confirmar", comandoId: 3, tarjeta: {}, latenciaMs: 0 } });
    const b = conf(abono);
    expect(siguiente([t, b], "dueno")).toBe(b);
  });

  it("no envía lo de otra persona con esta sesión", () => {
    expect(siguiente([conf(venta, { usuarioId: "ayudante" })], "dueno")).toBeNull();
  });

  it("una confirmación rechazada frena a las que vienen detrás", () => {
    const rechazada = conf(venta, { estado: "rechazada", error: "no" });
    expect(siguiente([rechazada, conf(abono)], "dueno")).toBeNull();
  });

  it("pero lo de antes del rechazo sí sale, y los audios no se frenan", () => {
    const antes = conf(abono);
    const rechazada = conf(venta, { estado: "rechazada" });
    const dictado = audio();
    expect(siguiente([antes, rechazada, dictado], "dueno")).toBe(antes);
    expect(siguiente([rechazada, dictado], "dueno")).toBe(dictado);
  });

  it("un audio rechazado no frena nada", () => {
    const b = conf(abono);
    expect(siguiente([audio({ estado: "rechazada" }), b], "dueno")).toBe(b);
  });

  it("vacía → null", () => expect(siguiente([], "dueno")).toBeNull());
});

describe("esperaTras", () => {
  it("dobla hasta un minuto", () => {
    expect([1, 2, 3, 4, 5, 9].map(esperaTras)).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
  });
  it("sin fallas todavía, 5 s", () => expect(esperaTras(0)).toBe(5_000));
});

describe("resumenDe", () => {
  it("una venta dice a quién, cuántas cajas y el total", () => expect(resumenDe(venta)).toBe(`Venta a Don Lucho · ${formatearCajas(3)} · ${formatearSoles(120)}`));
  it("una venta sin precio no inventa un total", () => {
    const sinPrecio: Operacion = { ...venta, entrada: { ...venta.entrada, borrador: { ...venta.entrada.borrador, cliente: null, items: [{ ...venta.entrada.borrador.items[0]!, precio: null }] } } };
    expect(resumenDe(sinPrecio)).toBe(`Venta · ${formatearCajas(3)}`);
  });
  it("un abono dice de quién y cuánto", () => expect(resumenDe(abono)).toBe(`Abono de Don Lucho · ${formatearSoles(80)}`));
});

describe("contarPorEnviar", () => {
  it("cuenta por tipo si todas son iguales", () => {
    expect(contarPorEnviar([conf(venta)])).toBe("1 venta");
    expect(contarPorEnviar([conf(venta), conf(venta)])).toBe("2 ventas");
    expect(contarPorEnviar([audio(), audio()])).toBe("2 dictados");
  });
  it("si son distintas, «operaciones»", () => expect(contarPorEnviar([conf(venta), conf(abono)])).toBe("2 operaciones"));
});

describe("franjaDe", () => {
  const base: Situacion = { enLinea: true, porEnviar: [], rechazada: null, enviando: false, esperando: false, sinSesion: false, enviadas: 0 };

  it("con señal y nada pendiente, no hay franja", () => expect(franjaDe(base)).toBeNull());

  it("sin señal siempre se dice, aunque no haya nada guardado", () => {
    expect(franjaDe({ ...base, enLinea: false })).toMatchObject({ tono: "sin_senal", titulo: "Sin señal" });
  });

  it("sin señal con algo guardado, dice cuánto", () => {
    expect(franjaDe({ ...base, enLinea: false, porEnviar: [conf(venta), conf(venta)] })?.detalle).toContain("2 ventas");
  });

  it("al volver la señal, dice que está enviando", () => {
    expect(franjaDe({ ...base, porEnviar: [conf(venta)], enviando: true })).toMatchObject({ tono: "enviando" });
  });

  it("si la señal está débil, ofrece enviar ahora", () => {
    expect(franjaDe({ ...base, porEnviar: [conf(venta)], esperando: true })).toMatchObject({ tono: "sin_senal", accion: "enviar" });
  });

  it("con la sesión vencida, pide entrar", () => {
    expect(franjaDe({ ...base, porEnviar: [conf(venta)], sinSesion: true })).toMatchObject({ accion: "entrar" });
  });

  it("un rechazo manda sobre todo, y dice qué y por qué", () => {
    const rechazada = conf(venta, { estado: "rechazada", resumen: "Venta a Don Lucho · 3 cajas", error: "Ese cliente ya no está en tu cuaderno. Elige a otro." });
    const f = franjaDe({ ...base, enLinea: false, rechazada });
    expect(f).toMatchObject({ tono: "error", accion: "descartar" });
    expect(f?.titulo).toContain("Don Lucho");
    expect(f?.detalle).toContain("ya no está");
  });

  it("al terminar, dice «Listo» un momento", () => expect(franjaDe({ ...base, enviadas: 3 })).toMatchObject({ tono: "listo" }));
});
