import { describe, expect, it } from "vitest";

import { REPOSO, SUBIDA_PARA_BLOQUEAR, TOQUE_MAXIMO_MS, avanceAlCandado, siguienteGesto, textoEscuchando, type EventoGesto, type Gesto } from "./gesto-reglas";

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

  it("escuchando sin el dedo, callarse envía solo; mientras se mantiene, manda el dedo", () => {
    const tocar: EventoGesto[] = [{ tipo: "bajar", en: 0 }, { tipo: "subir", en: 120 }];
    expect(recorrer([...tocar, { tipo: "silencio" }])).toEqual({ fase: "reposo", efectos: ["empezar", "bloquear", "enviar"] });
    expect(recorrer([{ tipo: "bajar", en: 0 }, { tipo: "silencio" }])).toEqual({ fase: "presionado", efectos: ["empezar"] });
    // El dedo bajó para enviar y se calló antes de levantarlo: se envía una sola vez.
    expect(recorrer([...tocar, { tipo: "bajar", en: 3000 }, { tipo: "silencio" }, { tipo: "subir", en: 3100 }])).toEqual({ fase: "reposo", efectos: ["empezar", "bloquear", "enviar"] });
    expect(siguienteGesto(REPOSO, { tipo: "silencio" }).efecto).toBe("nada");
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

describe("deslizar hacia arriba", () => {
  const manteniendo: Gesto = { fase: "presionado", desde: 0 };

  it("al llegar al candado queda escuchando, y soltar ya no envía", () => {
    const r = siguienteGesto(manteniendo, { tipo: "deslizar", subida: SUBIDA_PARA_BLOQUEAR });
    expect(r).toEqual({ gesto: { fase: "bloqueado" }, efecto: "bloquear" });
    expect(siguienteGesto(r.gesto, { tipo: "subir", en: 2000 })).toEqual({ gesto: { fase: "bloqueado" }, efecto: "nada" });
  });

  it("subir un poco y soltar envía, como mantener", () => {
    expect(
      recorrer([{ tipo: "bajar", en: 0 }, { tipo: "deslizar", subida: SUBIDA_PARA_BLOQUEAR - 1 }, { tipo: "subir", en: 1500 }]),
    ).toEqual({ fase: "reposo", efectos: ["empezar", "enviar"] });
  });

  it("deslizar solo cuenta mientras se mantiene", () => {
    for (const g of [REPOSO, { fase: "bloqueado" }, { fase: "cerrando" }] as Gesto[]) {
      expect(siguienteGesto(g, { tipo: "deslizar", subida: 500 })).toEqual({ gesto: g, efecto: "nada" });
    }
  });

  it("el avance al candado va de 0 a 1 en pasos de 0.1", () => {
    expect(avanceAlCandado(-30)).toBe(0);
    expect(avanceAlCandado(SUBIDA_PARA_BLOQUEAR / 2)).toBe(0.5);
    expect(avanceAlCandado(SUBIDA_PARA_BLOQUEAR * 3)).toBe(1);
  });
});

describe("textoEscuchando", () => {
  it("dice el tiempo escuchando, en segundos enteros", () => {
    expect(textoEscuchando(3.7)).toBe("Te escucho… 0:03");
    expect(textoEscuchando(12)).toBe("Te escucho… 0:12");
  });

  it("no muestra tiempos imposibles", () => {
    expect(textoEscuchando(-1)).toBe("Te escucho… 0:00");
    expect(textoEscuchando(75)).toBe("Te escucho… 0:59");
  });
});
