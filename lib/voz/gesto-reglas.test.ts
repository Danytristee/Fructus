import { describe, expect, it } from "vitest";

import { REPOSO, TOQUE_MAXIMO_MS, siguienteGesto, textoEscuchando, type EventoGesto, type Gesto } from "./gesto-reglas";

/** Aplica los eventos en orden y devuelve el gesto final y los efectos que no fueron «nada». */
function recorrer(eventos: EventoGesto[], desde: Gesto = REPOSO) {
  let g = desde;
  const efectos: string[] = [];
  for (const e of eventos) {
    const r = siguienteGesto(g, e);
    g = r.gesto;
    if (r.efecto !== "nada") efectos.push(r.efecto);
  }
  return { fase: g.fase, efectos };
}

describe("siguienteGesto", () => {
  it("mantener y soltar envía, como siempre", () => {
    expect(recorrer([{ tipo: "bajar", en: 0 }, { tipo: "subir", en: 1500 }])).toEqual({ fase: "reposo", efectos: ["empezar", "enviar"] });
  });

  it("un toque corto deja el botón escuchando, y el siguiente toque envía", () => {
    const tocar = (en: number): EventoGesto[] => [{ tipo: "bajar", en }, { tipo: "subir", en: en + 120 }];
    expect(recorrer(tocar(0))).toEqual({ fase: "bloqueado", efectos: ["empezar", "bloquear"] });
    expect(recorrer([...tocar(0), ...tocar(4000)])).toEqual({ fase: "reposo", efectos: ["empezar", "bloquear", "enviar"] });
  });

  it("el límite entre toque y mantener es TOQUE_MAXIMO_MS", () => {
    expect(recorrer([{ tipo: "bajar", en: 0 }, { tipo: "subir", en: TOQUE_MAXIMO_MS - 1 }]).fase).toBe("bloqueado");
    expect(recorrer([{ tipo: "bajar", en: 0 }, { tipo: "subir", en: TOQUE_MAXIMO_MS }]).fase).toBe("reposo");
  });

  it("escuchando sin el dedo, envía al levantar el segundo toque, no al bajarlo", () => {
    const r = siguienteGesto({ fase: "bloqueado" }, { tipo: "bajar", en: 0 });
    expect(r).toEqual({ gesto: { fase: "cerrando" }, efecto: "nada" });
    expect(siguienteGesto(r.gesto, { tipo: "subir", en: 80 }).efecto).toBe("enviar");
  });

  it("si el navegador se queda con el segundo toque, sigue escuchando: no se pierde lo dicho", () => {
    expect(siguienteGesto({ fase: "cerrando" }, { tipo: "perder" })).toEqual({ gesto: { fase: "bloqueado" }, efecto: "nada" });
    expect(siguienteGesto({ fase: "bloqueado" }, { tipo: "perder" }).efecto).toBe("nada");
  });

  it("si el navegador se queda con el toque mientras se mantiene, envía", () => {
    expect(siguienteGesto({ fase: "presionado", desde: 0 }, { tipo: "perder" })).toEqual({ gesto: REPOSO, efecto: "enviar" });
  });

  it("cancelar descarta en cualquier momento de la escucha", () => {
    for (const g of [{ fase: "presionado", desde: 0 }, { fase: "bloqueado" }, { fase: "cerrando" }] as Gesto[]) {
      expect(siguienteGesto(g, { tipo: "cancelar" })).toEqual({ gesto: REPOSO, efecto: "descartar" });
    }
  });

  it("al tope de escucha envía solo, con o sin el dedo", () => {
    for (const g of [{ fase: "presionado", desde: 0 }, { fase: "bloqueado" }, { fase: "cerrando" }] as Gesto[]) {
      expect(siguienteGesto(g, { tipo: "tope" })).toEqual({ gesto: REPOSO, efecto: "enviar" });
    }
  });

  it("en reposo solo el toque hace algo", () => {
    for (const e of [{ tipo: "subir", en: 5 }, { tipo: "perder" }, { tipo: "cancelar" }, { tipo: "tope" }] as EventoGesto[]) {
      expect(siguienteGesto(REPOSO, e)).toEqual({ gesto: REPOSO, efecto: "nada" });
    }
  });
});

describe("textoEscuchando", () => {
  it("con el dedo encima, solo el tiempo; sin el dedo, también cómo terminar", () => {
    expect(textoEscuchando(3.7, false)).toBe("Te escucho… 0:03");
    expect(textoEscuchando(12, true)).toBe("Te escucho 0:12 · toca para enviar");
  });

  it("no muestra tiempos imposibles", () => {
    expect(textoEscuchando(-1, false)).toBe("Te escucho… 0:00");
    expect(textoEscuchando(75, true)).toBe("Te escucho 0:59 · toca para enviar");
  });
});
