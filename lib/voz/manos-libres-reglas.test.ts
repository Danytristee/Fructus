import { describe, expect, it } from "vitest";

import { CALLADO, LEYENDO, notaManosLibres, siguienteManosLibres, type EstadoManosLibres, type EventoManosLibres } from "./manos-libres-reglas";

function recorrer(eventos: EventoManosLibres[], desde: EstadoManosLibres = LEYENDO) {
  let e = desde;
  const efectos: string[] = [];
  for (const ev of eventos) {
    const r = siguienteManosLibres(e, ev);
    e = r.estado;
    if (r.efecto !== "nada") efectos.push(r.efecto);
  }
  return { estado: e, efectos };
}

// Terminó de leer y el micrófono abrió.
const leida = { tipo: "leida", completa: true } as const;
const abierto = { tipo: "abierto" } as const;
const callo = { tipo: "callo" } as const;
const respuesta = (r: "confirmar" | "otra" | "fallo") => ({ tipo: "respuesta", respuesta: r }) as const;

describe("siguienteManosLibres", () => {
  it("lee, escucha, oye «confirmo» y guarda", () => {
    const r = recorrer([leida, abierto, callo, respuesta("confirmar")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "confirmar"]);
    expect(r.estado.fase).toBe("guardando");
  });

  it("mientras lee no escucha: el micrófono se abre recién cuando termina de leer", () => {
    expect(recorrer([callo, respuesta("confirmar")]).efectos).toEqual([]);
  });

  it("si oyó otra cosa, repregunta una sola vez; la segunda, deja la tarjeta para tocar sin guardar", () => {
    const r = recorrer([leida, abierto, callo, respuesta("otra"), leida, abierto, callo, respuesta("otra")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "repreguntar", "escuchar", "enviar"]);
    expect(r.estado).toEqual({ fase: "callado", intento: 2, motivo: "no_confirmo" });
    expect(recorrer([leida, abierto, callo, respuesta("otra"), leida, abierto, callo, respuesta("confirmar")]).estado.fase).toBe("guardando");
  });

  it("si no habló en la ventana, deja de escuchar y la tarjeta queda para tocar", () => {
    const r = recorrer([leida, abierto, { tipo: "vencio" }]);
    expect(r.efectos).toEqual(["escuchar", "descartar"]);
    expect(r.estado.motivo).toBe("no_hablo");
  });

  it("«Te escucho» recién cuando el micrófono graba; si no abre (sin permiso), la tarjeta queda para tocar", () => {
    expect(recorrer([leida]).estado.fase).toBe("abriendo");
    expect(notaManosLibres(recorrer([leida]).estado)).toBe("Te la estoy leyendo…");
    expect(notaManosLibres(recorrer([leida, abierto]).estado)).toContain("Te escucho");
    expect(recorrer([leida, callo]).efectos).toEqual(["escuchar"]); // lo que llegue antes de abrir no se envía
    expect(recorrer([leida, { tipo: "vencio" }]).estado).toMatchObject({ fase: "callado", motivo: "no_hablo" });
  });

  it("si el servidor no respondió, no guarda y pide el toque", () => {
    expect(recorrer([leida, abierto, callo, respuesta("fallo")]).estado).toMatchObject({ fase: "callado", motivo: "fallo" });
  });

  it("tocar la tarjeta calla todo, y lo que llegue después del servidor ya no guarda", () => {
    expect(recorrer([{ tipo: "tocaron" }]).efectos).toEqual(["callar"]);
    expect(recorrer([leida, { tipo: "tocaron" }]).efectos).toEqual(["escuchar", "callar"]);
    const tarde = recorrer([leida, abierto, callo, { tipo: "tocaron" }, respuesta("confirmar")]);
    expect(tarde.efectos).toEqual(["escuchar", "enviar", "callar"]);
    expect(tarde.estado.fase).toBe("callado");
  });

  it("si la lectura se cortó (otra frase, un toque), no escucha", () => {
    expect(recorrer([{ tipo: "leida", completa: false }])).toEqual({ estado: CALLADO, efectos: [] });
  });

  it("guardando, un toque no cambia nada: la venta ya va en camino", () => {
    expect(recorrer([leida, abierto, callo, respuesta("confirmar"), { tipo: "tocaron" }]).estado.fase).toBe("guardando");
  });
});

describe("notaManosLibres", () => {
  it("dice qué hace la voz, y por qué se dejó para tocar", () => {
    expect(notaManosLibres(LEYENDO)).toBe("Te la estoy leyendo…");
    expect(notaManosLibres({ fase: "escuchando", intento: 1, motivo: null })).toContain("di «confirmo»");
    expect(notaManosLibres({ fase: "callado", intento: 1, motivo: "no_hablo" })).toBe("No te oí. Si está bien, toca Confirmar.");
    expect(notaManosLibres(CALLADO)).toBeNull();
  });
});
