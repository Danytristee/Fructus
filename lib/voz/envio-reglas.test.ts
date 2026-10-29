import { describe, expect, it } from "vitest";

import { desenlaceDeRespuesta, desenlaceSinRed, NO_TE_ENTENDI } from "./envio-reglas";

const venta = { tipo: "venta", cliente: { dicho: null, elegido: null, opciones: [] }, items: [], falta: [] };

describe("desenlaceDeRespuesta", () => {
  it("con tarjeta, la abre", () => {
    expect(desenlaceDeRespuesta(200, { comandoId: 7, tarjeta: venta, latenciaMs: 900 })).toEqual({ tipo: "tarjeta", comandoId: 7, tarjeta: venta });
  });

  it("si no entendió nada, pide decirlo otra vez y no guarda el audio", () => {
    expect(desenlaceDeRespuesta(200, { comandoId: 7, tarjeta: { tipo: "no_entendido", mensaje: "x" } })).toEqual({
      tipo: "error",
      mensaje: NO_TE_ENTENDI,
      conservarAudio: false,
    });
  });

  it("un 200 sin tarjeta es una falla del servicio: guarda el audio", () => {
    expect(desenlaceDeRespuesta(200, { ok: true })).toMatchObject({ tipo: "error", conservarAudio: true });
  });

  it("sin sesión guarda el audio para después de entrar", () => {
    expect(desenlaceDeRespuesta(401, { error: "Tu sesión terminó. Vuelve a entrar." })).toEqual({
      tipo: "error",
      mensaje: "Tu sesión terminó. Vuelve a entrar.",
      conservarAudio: true,
    });
  });

  it("un audio que no sirve (muy largo, sin permiso) no se guarda: reintentarlo daría lo mismo", () => {
    expect(desenlaceDeRespuesta(413, { error: "El audio es muy largo. Dilo en menos de un minuto." })).toMatchObject({ conservarAudio: false });
    expect(desenlaceDeRespuesta(403, { error: "Tu cuenta no puede registrar operaciones." })).toMatchObject({ conservarAudio: false });
  });

  it("si falla un servicio, usa el mensaje del servidor y guarda el audio salvo que diga lo contrario", () => {
    expect(desenlaceDeRespuesta(502, { error: NO_TE_ENTENDI, conservarAudio: true })).toEqual({ tipo: "error", mensaje: NO_TE_ENTENDI, conservarAudio: true });
    expect(desenlaceDeRespuesta(503, { error: "No pudimos buscar en tu cuaderno." })).toMatchObject({ conservarAudio: true });
    expect(desenlaceDeRespuesta(502, { conservarAudio: false })).toMatchObject({ mensaje: NO_TE_ENTENDI, conservarAudio: false });
  });

  it("si el cuerpo no era JSON, igual dice qué hacer", () => {
    expect(desenlaceDeRespuesta(500, null)).toEqual({ tipo: "error", mensaje: NO_TE_ENTENDI, conservarAudio: true });
  });
});

describe("desenlaceSinRed", () => {
  it("avisa que no hay señal y guarda el audio", () => {
    expect(desenlaceSinRed()).toMatchObject({ tipo: "error", conservarAudio: true, mensaje: expect.stringContaining("Sin señal") });
  });
});
