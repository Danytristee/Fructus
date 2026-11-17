import { describe, expect, it } from "vitest";

import { decidirSoltar, duracionCierre, ejeDelGesto, opacidadVelo, resistencia, umbralCierre, velocidadDe } from "./hoja-reglas";

describe("resistencia", () => {
  it("hacia abajo la hoja sigue al dedo exacto", () => {
    expect(resistencia(0, 400)).toBe(0);
    expect(resistencia(120, 400)).toBe(120);
  });

  it("hacia arriba se estira menos que el dedo, y cada vez menos", () => {
    const poco = resistencia(-50, 400);
    const mucho = resistencia(-300, 400);
    expect(poco).toBeLessThan(0);
    expect(-poco).toBeLessThan(50);
    expect(-mucho).toBeLessThan(300);
    // el doble de dedo no da el doble de hoja
    expect(-resistencia(-200, 400)).toBeLessThan(-resistencia(-100, 400) * 2);
    // nunca pasa del tamaño de referencia
    expect(-resistencia(-100000, 400)).toBeLessThan(400);
  });
});

describe("velocidadDe", () => {
  it("con una muestra no hay velocidad", () => {
    expect(velocidadDe([{ y: 10, t: 0 }])).toBe(0);
  });

  it("mide los últimos 80 ms, no todo el gesto", () => {
    // bajó lento 100 px en 1 s y después 60 px en 60 ms (un tirón)
    const muestras = [
      { y: 0, t: 0 },
      { y: 100, t: 1000 },
      { y: 120, t: 1020 },
      { y: 140, t: 1040 },
      { y: 160, t: 1060 },
    ];
    expect(velocidadDe(muestras)).toBeCloseTo(1, 5);
  });

  it("si el dedo sube, es negativa", () => {
    expect(velocidadDe([{ y: 100, t: 0 }, { y: 70, t: 30 }])).toBeCloseTo(-1, 5);
  });
});

describe("decidirSoltar", () => {
  const alto = 600;

  it("si no la bajó, vuelve", () => {
    expect(decidirSoltar({ desplazamiento: 0, alto, velocidad: 2 })).toBe("volver");
    expect(decidirSoltar({ desplazamiento: -30, alto, velocidad: 0 })).toBe("volver");
  });

  it("un tirón rápido la cierra aunque haya bajado poco", () => {
    expect(decidirSoltar({ desplazamiento: 40, alto, velocidad: 0.9 })).toBe("cerrar");
    expect(decidirSoltar({ desplazamiento: 30, alto, velocidad: 0.42 })).toBe("cerrar");
    // un temblor del dedo no es un tirón
    expect(decidirSoltar({ desplazamiento: 8, alto, velocidad: 0.9 })).toBe("volver");
  });

  it("bajarla despacio un poco no la cierra; pasar el umbral sí", () => {
    expect(decidirSoltar({ desplazamiento: 60, alto, velocidad: 0.05 })).toBe("volver");
    expect(decidirSoltar({ desplazamiento: umbralCierre(alto) + 1, alto, velocidad: 0 })).toBe("cerrar");
  });

  it("si al soltar el dedo ya iba subiendo, vuelve aunque esté abajo", () => {
    expect(decidirSoltar({ desplazamiento: 400, alto, velocidad: -0.4 })).toBe("volver");
  });
});

describe("umbralCierre", () => {
  it("un tercio de la hoja, con piso y techo", () => {
    expect(umbralCierre(300)).toBe(99);
    expect(umbralCierre(100)).toBe(56);
    expect(umbralCierre(2000)).toBe(240);
  });
});

describe("duracionCierre", () => {
  it("sin impulso, el tiempo de siempre", () => {
    expect(duracionCierre({ desplazamiento: 200, alto: 600, velocidad: 0 })).toBe(280);
  });

  it("con impulso, sigue a la velocidad del dedo, entre 140 y 300 ms", () => {
    expect(duracionCierre({ desplazamiento: 100, alto: 600, velocidad: 2 })).toBe(265);
    expect(duracionCierre({ desplazamiento: 500, alto: 600, velocidad: 5 })).toBe(140);
  });
});

describe("ejeDelGesto", () => {
  it("todavía no se sabe con un par de píxeles", () => {
    expect(ejeDelGesto(2, 3)).toBeNull();
  });

  it("de lado es horizontal; abajo o arriba, vertical", () => {
    expect(ejeDelGesto(20, 4)).toBe("horizontal");
    expect(ejeDelGesto(3, 12)).toBe("vertical");
    expect(ejeDelGesto(-3, -12)).toBe("vertical");
  });
});

describe("opacidadVelo", () => {
  it("se aclara al bajar y nunca es negativa", () => {
    expect(opacidadVelo(0, 500)).toBe(1);
    expect(opacidadVelo(250, 500)).toBe(0.5);
    expect(opacidadVelo(900, 500)).toBe(0);
    expect(opacidadVelo(-40, 500)).toBe(1);
  });
});
