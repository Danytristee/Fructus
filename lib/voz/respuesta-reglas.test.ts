import { describe, expect, it } from "vitest";

import { clasificarRespuesta } from "./respuesta-reglas";

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
