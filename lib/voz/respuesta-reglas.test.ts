import { describe, expect, it } from "vitest";

import { clasificarPago, clasificarRespuesta, pareceCorreccion, hablaDeUnaParte } from "./respuesta-reglas";

describe("clasificarRespuesta", () => {
  it.each(["Confirmo.", "Correcto", "¡Acepto!", "Sí, correcto.", "Ya, confirmo", "Todo correcto", "Correcto, correcto.", "Está correcto"])(
    "«%s» confirma",
    (dicho) => expect(clasificarRespuesta(dicho)).toBe("confirmar"),
  );

  it.each(["Sí", "Sí, sí", "Ya", "Listo", "Ok", "Dale"])("«%s» suelto no confirma: en el puesto se dice todo el tiempo", (dicho) =>
    expect(clasificarRespuesta(dicho)).toBe("otra"),
  );

  it.each(["No", "No, correcto no", "Espera", "Correcto no", "Cancela"])("«%s» niega: no confirma", (dicho) =>
    expect(clasificarRespuesta(dicho)).toBe("otra"),
  );

  it.each(["Correcto, pero son ocho cajas", "No, son ocho", "A don Lucho, correcto"])("«%s» agrega algo: no se confirma a medias", (dicho) =>
    expect(clasificarRespuesta(dicho)).toBe("otra"),
  );

  it.each(["Repite", "Repítelo, por favor", "¿Qué?", "¿Cómo?", "¿Qué dijiste?", "Otra vez", "No te escuché", "No escuché nada", "Perdón, ¿qué?"])(
    "«%s» pide que lo lea otra vez",
    (dicho) => expect(clasificarRespuesta(dicho)).toBe("repetir"),
  );

  it("lo que confirma no se toma como «repite», y lo que mezcla las dos no se adivina", () => {
    expect(clasificarRespuesta("Correcto, otra vez")).toBe("otra"); // ¿confirma o pide repetir? se repregunta
    expect(clasificarRespuesta("¿Qué fruta era?")).toBe("otra"); // pregunta otra cosa: no es «repite»
  });

  it("el silencio o lo que Whisper inventa en el silencio no confirma", () => {
    expect(clasificarRespuesta("")).toBe("otra");
    expect(clasificarRespuesta("Gracias por ver el video.")).toBe("otra");
    expect(clasificarRespuesta("...")).toBe("otra");
  });
});

describe("hablaDeUnaParte", () => {
  it("un monto o una parte: va al intérprete como corrección", () => {
    for (const t of ["Pagó 500", "Pagó quinientos", "Solo pagó mil", "Me dio la mitad", "Me yapeó doscientos y lo demás lo debe"]) expect(hablaDeUnaParte(t)).toBe(true);
  });
  it("«pagó», «lo debe» o «con Yape» no traen monto: no hace falta el intérprete", () => {
    for (const t of ["Pagó", "Lo debe", "Con Yape", "Pagó todo en efectivo", "Fiado"]) expect(hablaDeUnaParte(t)).toBe(false);
  });
});

describe("clasificarPago", () => {
  // ADR-0025: los números se borraban y «pagó 500» quedaba en «pagó»: la venta se guardaba como pagada entera. Con un monto o una
  // parte no se anota nada: se repregunta y la parte se anota en la tarjeta («Pagó una parte»). Nunca se asume contado.
  it.each(["Pagó 500", "Pagó quinientos", "Solo pagó mil", "Pagó una parte", "Me dio la mitad", "Dejó 200 y el resto lo debe", "Pagó nomás cien con Yape"])(
    "«%s» trae un monto o una parte: no se anota",
    (texto) => expect(clasificarPago(texto)).toBeNull(),
  );

  it.each([
    ["Pagó.", { condicion: "contado", medio: "efectivo" }],
    ["Pagó con Yape", { condicion: "contado", medio: "yape" }],
    ["Yape", { condicion: "contado", medio: "yape" }],
    ["Plin", { condicion: "contado", medio: "plin" }],
    ["Canceló", { condicion: "contado", medio: "efectivo" }],
    ["Por transferencia", { condicion: "contado", medio: "transferencia" }],
    ["Lo debe", { condicion: "credito", medio: null }],
    ["Fiado", { condicion: "credito", medio: null }],
    ["A cuenta", { condicion: "credito", medio: null }],
    ["Me paga después", { condicion: "credito", medio: null }],
    ["No pagó", { condicion: "credito", medio: null }],
    ["Todavía no paga", null],
  ])("«%s»", (dicho, esperado) => expect(clasificarPago(dicho)).toEqual(esperado));

  it("lo que no se entiende, o dice las dos cosas, no se adivina: nunca se asume contado", () => {
    expect(clasificarPago("Sí")).toBeNull();
    expect(clasificarPago("")).toBeNull();
    expect(clasificarPago("Pagó la mitad y lo demás lo debe")).toBeNull();
    expect(clasificarPago("No debe nada")).toBeNull();
  });
});

describe("pareceCorreccion", () => {
  it.each(["No, son ocho cajas", "A cuarenta", "No, es para don Lucho", "La palta a 55"])("«%s» corrige algo: va al intérprete", (dicho) =>
    expect(pareceCorreccion(dicho)).toBe(true),
  );

  it.each(["No", "Sí", "No, no", "Ya, ok", "Espera", ""])("«%s» no corrige nada: se repregunta sin llamar al modelo", (dicho) =>
    expect(pareceCorreccion(dicho)).toBe(false),
  );
});
