import { describe, expect, it } from "vitest";

import { CALLADO, leyendo, notaManosLibres, siguienteManosLibres, type EstadoManosLibres, type EventoManosLibres } from "./manos-libres-reglas";

function recorrer(eventos: EventoManosLibres[], desde: EstadoManosLibres = leyendo("confirmar")) {
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
const oir = [leida, abierto, callo] as const;
const respuesta = (r: "confirmar" | "corregir" | "otra" | "fallo") => ({ tipo: "respuesta", respuesta: r }) as const;
const lodebe = { tipo: "pago", pago: { condicion: "credito", medio: null } } as const;

describe("siguienteManosLibres: «¿Confirmo?»", () => {
  it("lee, escucha, oye «confirmo» y guarda", () => {
    const r = recorrer([...oir, respuesta("confirmar")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "confirmar"]);
    expect(r.estado.fase).toBe("guardando");
  });

  it("mientras lee no escucha: el micrófono se abre recién cuando termina de leer", () => {
    expect(recorrer([callo, respuesta("confirmar")]).efectos).toEqual([]);
  });

  it("«Te escucho» recién cuando el micrófono graba; lo que llegue antes de abrir no se envía", () => {
    expect(recorrer([leida]).estado.fase).toBe("abriendo");
    expect(notaManosLibres(recorrer([leida]).estado)).toBe("Te la estoy leyendo…");
    expect(notaManosLibres(recorrer([leida, abierto]).estado)).toContain("Te escucho");
    expect(recorrer([leida, callo]).efectos).toEqual(["escuchar"]);
  });

  it("si oyó otra cosa, repregunta una sola vez; la segunda, deja la tarjeta para tocar sin guardar", () => {
    const r = recorrer([...oir, respuesta("otra"), ...oir, respuesta("otra")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "repreguntar", "escuchar", "enviar"]);
    expect(r.estado).toMatchObject({ fase: "callado", intento: 2, motivo: "no_entendio" });
    expect(recorrer([...oir, respuesta("otra"), ...oir, respuesta("confirmar")]).estado.fase).toBe("guardando");
  });

  it("si no habló en la ventana, o no hay micrófono, deja de escuchar y la tarjeta queda para tocar", () => {
    expect(recorrer([leida, abierto, { tipo: "vencio" }])).toMatchObject({ efectos: ["escuchar", "descartar"], estado: { motivo: "no_hablo" } });
    expect(recorrer([leida, { tipo: "vencio" }]).estado).toMatchObject({ fase: "callado", motivo: "no_hablo" });
  });

  it("sin señal no se escucha, y si se cae mientras entiende, no guarda", () => {
    expect(recorrer([leida, { tipo: "sin_senal" }]).estado).toMatchObject({ fase: "callado", motivo: "sin_senal" });
    expect(recorrer([...oir, { tipo: "sin_senal" }]).estado).toMatchObject({ fase: "callado", motivo: "sin_senal" });
  });

  it("si el servidor no respondió, no guarda y pide el toque", () => {
    expect(recorrer([...oir, respuesta("fallo")]).estado).toMatchObject({ fase: "callado", motivo: "fallo" });
  });

  it("tocar la tarjeta calla todo, y lo que llegue después del servidor ya no guarda", () => {
    expect(recorrer([{ tipo: "tocaron" }]).efectos).toEqual(["callar"]);
    const tarde = recorrer([...oir, { tipo: "tocaron" }, respuesta("confirmar")]);
    expect(tarde.efectos).toEqual(["escuchar", "enviar", "callar"]);
    expect(tarde.estado.fase).toBe("callado");
  });

  it("si la lectura se cortó (otra frase, un toque), no escucha", () => {
    expect(recorrer([{ tipo: "leida", completa: false }]).efectos).toEqual([]);
  });

  it("guardando, un toque no cambia nada: la venta ya va en camino", () => {
    expect(recorrer([...oir, respuesta("confirmar"), { tipo: "tocaron" }]).estado.fase).toBe("guardando");
  });
});

describe("siguienteManosLibres: «¿Pagó o lo debe?» y los avisos", () => {
  it("pregunta si pagó, anota la respuesta, lee la venta completa y la confirma", () => {
    const r = recorrer([...oir, lodebe, { tipo: "anotado", lista: true }, ...oir, respuesta("confirmar")], leyendo("pago"));
    expect(r.efectos).toEqual(["escuchar", "enviar", "anotar", "releer", "escuchar", "enviar", "confirmar"]);
    expect(r.estado.fase).toBe("guardando");
  });

  it("una respuesta de pago no confirma: siempre se lee la venta y se pregunta «¿Confirmo?»", () => {
    expect(recorrer([...oir, respuesta("confirmar")], leyendo("pago")).estado.fase).toBe("entendiendo");
  });

  it("si no se entendió si pagó, lo pregunta una vez más; después, se toca Pagó o Lo debe", () => {
    const sinEntender = { tipo: "pago", pago: null } as const;
    const r = recorrer([...oir, sinEntender, ...oir, sinEntender], leyendo("pago"));
    expect(r.efectos).toEqual(["escuchar", "enviar", "repreguntar", "escuchar", "enviar"]);
    expect(notaManosLibres(r.estado)).toBe("No te entendí. Toca Pagó o Lo debe.");
  });

  it("si al anotarlo falta un dato (lo debe, pero no se sabe quién), no se lee: se elige en la tarjeta", () => {
    expect(recorrer([...oir, lodebe, { tipo: "anotado", lista: false }], leyendo("pago")).estado).toMatchObject({ fase: "callado", motivo: "falta" });
  });

  it("un aviso (dudas, falta el precio) se dice y no se escucha: se confirma con el dedo", () => {
    const r = recorrer([leida], leyendo("ninguna"));
    expect(r).toEqual({ estado: { ...leyendo("ninguna"), fase: "callado", motivo: "aviso" }, efectos: [] });
    expect(notaManosLibres(r.estado)).toBeNull();
  });
});

describe("siguienteManosLibres: corregir hablando", () => {
  it("«no, son ocho cajas»: rehace la tarjeta, la vuelve a leer y se confirma", () => {
    const r = recorrer([...oir, respuesta("corregir"), { tipo: "corregida", pregunta: "confirmar" }, ...oir, respuesta("confirmar")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "corregir", "releer", "escuchar", "enviar", "confirmar"]);
    expect(r.estado.fase).toBe("guardando");
  });

  it("la venta corregida puede volver a corregirse, y no gasta la repregunta", () => {
    const corregir = [...oir, respuesta("corregir"), { tipo: "corregida", pregunta: "confirmar" } as const];
    const r = recorrer([...corregir, ...corregir, ...oir, respuesta("otra"), ...oir, respuesta("confirmar")]);
    expect(r.efectos.filter((x) => x === "corregir")).toHaveLength(2);
    expect(r.efectos).toContain("repreguntar");
    expect(r.estado.fase).toBe("guardando");
  });

  it("si la corrección deja una duda, lo dice y no escucha: se confirma con el dedo", () => {
    const r = recorrer([...oir, respuesta("corregir"), { tipo: "corregida", pregunta: "ninguna" }, leida]);
    expect(r.estado).toMatchObject({ fase: "callado", motivo: "aviso" });
  });

  it("tocar mientras se rehace la tarjeta calla todo", () => {
    expect(recorrer([...oir, respuesta("corregir"), { tipo: "tocaron" }, { tipo: "corregida", pregunta: "confirmar" }]).estado.fase).toBe("callado");
  });
});

describe("siguienteManosLibres: «repite»", () => {
  const repite = { tipo: "repetir" } as const;

  it("vuelve a leer lo mismo y escucha de nuevo; después se confirma", () => {
    const r = recorrer([...oir, repite, ...oir, respuesta("confirmar")]);
    expect(r.efectos).toEqual(["escuchar", "enviar", "repetir", "escuchar", "enviar", "confirmar"]);
    expect(r.estado.fase).toBe("guardando");
  });

  it("hasta dos veces: la tercera cuenta como otra cosa (nada se lee en bucle)", () => {
    const r = recorrer([...oir, repite, ...oir, repite, ...oir, repite]);
    expect(r.efectos.filter((x) => x === "repetir")).toHaveLength(2);
    expect(r.efectos.at(-1)).toBe("repreguntar");
  });

  it("también al preguntar si pagó", () => {
    expect(recorrer([...oir, repite], leyendo("pago")).efectos).toEqual(["escuchar", "enviar", "repetir"]);
  });
});

describe("notaManosLibres", () => {
  it("dice qué hace la voz, y por qué se dejó para tocar", () => {
    expect(notaManosLibres({ ...leyendo("pago"), fase: "escuchando" })).toBe("Te escucho: di «pagó» o «lo debe».");
    expect(notaManosLibres({ ...leyendo("confirmar"), fase: "escuchando" }, { corrige: true })).toBe("Te escucho: di «confirmo», «repite» o lo que hay que cambiar.");
    expect(notaManosLibres({ ...leyendo("confirmar"), fase: "escuchando" })).toBe("Te escucho: di «confirmo» o toca Confirmar.");
    expect(notaManosLibres({ ...leyendo("confirmar"), fase: "callado", motivo: "no_hablo" })).toBe("No te oí. Si está bien, toca Confirmar.");
    expect(notaManosLibres({ ...leyendo("confirmar"), fase: "callado", motivo: "sin_senal" })).toBe("Sin señal no te entiendo. Si está bien, toca Confirmar.");
    expect(notaManosLibres(CALLADO)).toBeNull();
  });
});
