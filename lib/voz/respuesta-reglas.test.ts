import { describe, expect, it } from "vitest";

import { clasificarPago, clasificarRespuesta } from "./respuesta-reglas";

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

  it("el silencio o lo que Whisper inventa en el silencio no confirma", () => {
    expect(clasificarRespuesta("")).toBe("otra");
    expect(clasificarRespuesta("Gracias por ver el video.")).toBe("otra");
    expect(clasificarRespuesta("...")).toBe("otra");
  });
});

describe("clasificarPago", () => {
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
