import { describe, expect, it } from "vitest";

import { aceptarEstimaciones, evidenciaDe, frutasPorEstimar, limitesDe, limitesDeAjuste, TOPE_POR_NOCHE, type Hechos } from "./vida-estimada-reglas";

const producto = (id: number, nombre: string, stock = 0, extra: { variedad?: string | null; calibre?: string | null } = {}) => ({
  id,
  nombre,
  variedad: extra.variedad ?? null,
  marca: null,
  seleccion: null,
  calibre: extra.calibre ?? null,
  kgPorCaja: null,
  stock,
});

/** Estimaciones que ya rigen (5 días, del 10 de noviembre a las 7 p. m. de Lima) para esos productos. */
const vigentes = (...ids: number[]) => new Map(ids.map((id) => [id, { dias: 5, motivo: "De antes.", dia: "2026-11-10", creadoEn: "2026-11-11T00:05:00+00:00" }]));

describe("frutasPorEstimar", () => {
  it("pide las frutas que todavía no tienen estimación, con su nombre completo y lo que dice la tabla", () => {
    const pedido = frutasPorEstimar([producto(1, "Mango", 4, { variedad: "Kent" }), producto(2, "Papaya", 2)], vigentes(2));
    expect(pedido).toEqual([{ id: 1, fruta: "Mango Kent", tabla: 7, minimo: 4, maximo: 10 }]);
  });

  it("no vuelve a preguntar lo que ya contestó: sin frutas nuevas no pide nada", () => {
    expect(frutasPorEstimar([producto(1, "Mango"), producto(2, "Papaya")], vigentes(1, 2))).toEqual([]);
  });

  it("primero las que tienen cajas en el puesto: son las que mueven el aviso de mañana", () => {
    const pedido = frutasPorEstimar([producto(1, "Pera"), producto(2, "Mango", 12), producto(3, "Uva"), producto(4, "Papaya", 3)], vigentes());
    expect(pedido.map((f) => f.id)).toEqual([2, 4, 1, 3]);
  });

  it("una noche no pide más del tope: lo que falta entra la noche siguiente", () => {
    const muchos = Array.from({ length: TOPE_POR_NOCHE + 15 }, (_, i) => producto(i + 1, "Mango", 0, { calibre: String(i) }));
    expect(frutasPorEstimar(muchos, vigentes())).toHaveLength(TOPE_POR_NOCHE);
  });

  it("una fruta que la tabla no conoce se pide con el valor de reserva (10 días)", () => {
    expect(frutasPorEstimar([producto(9, "Pitahaya")], vigentes())[0]).toEqual({ id: 9, fruta: "Pitahaya", tabla: 10, minimo: 5, maximo: 15 });
  });
});

describe("limitesDe", () => {
  it("la estimación no se aleja más de la mitad de lo que dice la tabla", () => {
    expect(limitesDe(10)).toEqual({ minimo: 5, maximo: 15 });
    expect(limitesDe(30)).toEqual({ minimo: 15, maximo: 45 });
  });

  it("con días impares redondea hacia adentro, y nunca baja de un día", () => {
    expect(limitesDe(7)).toEqual({ minimo: 4, maximo: 10 });
    expect(limitesDe(1)).toEqual({ minimo: 1, maximo: 1 });
  });
});

describe("aceptarEstimaciones", () => {
  const pedidas = [
    { id: 1, fruta: "Mango Kent", tabla: 7, minimo: 4, maximo: 10 },
    { id: 2, fruta: "Manzana Fuji", tabla: 30, minimo: 15, maximo: 45 },
  ];

  it("acepta lo que cae dentro del margen, en días enteros", () => {
    const r = aceptarEstimaciones(pedidas, {
      estimaciones: [
        { producto_id: 1, dias: 6.4, motivo: "El Kent llega firme y aguanta bien." },
        { producto_id: 2, dias: 40, motivo: "La Fuji es de las que más duran." },
      ],
    });
    expect(r).toEqual([
      { productoId: 1, dias: 6, motivo: "El Kent llega firme y aguanta bien.", recortada: false },
      { productoId: 2, dias: 40, motivo: "La Fuji es de las que más duran.", recortada: false },
    ]);
  });

  it("recorta lo que se va del margen, y lo dice: «el mango aguanta 40 días» apagaría el aviso", () => {
    const r = aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 1, dias: 40, motivo: "Dura mucho." }] });
    expect(r).toEqual([{ productoId: 1, dias: 10, motivo: "Dura mucho.", recortada: true }]);
    expect(aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 1, dias: 1, motivo: "Se pasa rápido." }] })[0]).toMatchObject({ dias: 4, recortada: true });
  });

  it("ignora una fruta que nadie pidió: el modelo no agrega productos", () => {
    expect(aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 99, dias: 7, motivo: "Inventada." }] })).toEqual([]);
  });

  it("si repite una fruta, vale la primera", () => {
    const r = aceptarEstimaciones(pedidas, {
      estimaciones: [
        { producto_id: 1, dias: 6, motivo: "Primera." },
        { producto_id: 1, dias: 9, motivo: "Segunda." },
      ],
    });
    expect(r).toEqual([{ productoId: 1, dias: 6, motivo: "Primera.", recortada: false }]);
  });

  it("descarta un número que no es un número de días, o cero, o negativo: sigue la tabla", () => {
    const r = aceptarEstimaciones(pedidas, {
      estimaciones: [
        { producto_id: 1, dias: Number.NaN, motivo: "Sin número." },
        { producto_id: 2, dias: -3, motivo: "Negativo." },
      ],
    });
    expect(r).toEqual([]);
  });

  it("una estimación sin motivo no se acepta: cada cambio se explica", () => {
    expect(aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 1, dias: 6, motivo: "   " }] })).toEqual([]);
  });

  it("el motivo queda en una línea y corto", () => {
    const largo = `El Kent  llega\nfirme. ${"Aguanta bien en el puesto. ".repeat(20)}`;
    const [uno] = aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 1, dias: 6, motivo: largo }] });
    expect(uno!.motivo.startsWith("El Kent llega firme.")).toBe(true);
    expect(uno!.motivo.length).toBeLessThanOrEqual(160);
    expect(uno!.motivo.endsWith("…")).toBe(true);
  });
});

// --- Se corrige sola: las mermas y los «Sigue buena» son evidencia para la estimación de la noche ---

const HOY = "2026-11-16";
/** Las 10 a. m. de Lima de ese día. */
const aLas10 = (dia: string) => `${dia}T15:00:00+00:00`;
const sinHechos: Hechos = { mermas: [], revisiones: [], entradas: [], lecturas: [] };

describe("limitesDeAjuste", () => {
  it("una noche mueve la estimación un día, o la quinta parte si es una fruta que dura mucho", () => {
    expect(limitesDeAjuste(7, 7)).toEqual({ minimo: 6, maximo: 8 });
    expect(limitesDeAjuste(30, 30)).toEqual({ minimo: 24, maximo: 36 });
  });

  it("y nunca sale del margen de la tabla, por muchas noches que pasen", () => {
    expect(limitesDeAjuste(7, 10)).toEqual({ minimo: 8, maximo: 10 });
    expect(limitesDeAjuste(7, 4)).toEqual({ minimo: 4, maximo: 5 });
  });
});

describe("evidenciaDe", () => {
  // Papaya, con 5 días de vida estimada y clima normal (sin lecturas, cada día gasta 1/5).
  const papaya = { id: 2, nombre: "Papaya" };
  const desde = "2026-11-11T00:05:00+00:00"; // cuándo se hizo su última estimación

  it("un «Sigue buena» dice cuánto de su vida llevaba gastada esa llegada cuando la revisaron", () => {
    // Llegó el 9, la revisaron el 15: siete días en el puesto con una vida de 5 → iba por 1.4 y seguía buena.
    const revisiones = [{ productoId: 2, llegadaDia: "2026-11-09", estado: null, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones }, HOY)).toEqual({
      evidencia: [{ tipo: "sigue_buena", haceDias: 1, gastado: 1.4 }],
      hayNueva: true,
    });
  });

  it("una merma se le cuenta a la llegada más vieja que había en el puesto en ese momento", () => {
    // Había 10 cajas: 4 del día 12 y, antes, 6 del día 10. Se malograron 2 el 14: las del 10, que llevaban 5 días → 1.0.
    const entradas = [
      { productoId: 2, fecha: aLas10("2026-11-10"), cantidad: 6, estado: null },
      { productoId: 2, fecha: aLas10("2026-11-12"), cantidad: 4, estado: null },
    ];
    const mermas = [{ productoId: 2, fecha: aLas10("2026-11-14"), cajas: 2, stockAntes: 10 }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, mermas, entradas }, HOY).evidencia).toEqual([{ tipo: "merma", haceDias: 2, cajas: 2, gastado: 1 }]);
    // Si para entonces ya solo quedaban 3 cajas, eran de la llegada del 12: llevaban 3 días → 0.6, se malogró antes de tiempo.
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, mermas: [{ ...mermas[0]!, stockAntes: 3 }], entradas }, HOY).evidencia).toEqual([{ tipo: "merma", haceDias: 2, cajas: 2, gastado: 0.6 }]);
  });

  it("el calor ya va contado: con días de 34° la misma llegada llevaba gastado el doble", () => {
    const lecturas = ["2026-11-12", "2026-11-13", "2026-11-14"].map((dia) => ({ dia, grados: 34 }));
    const entradas = [{ productoId: 2, fecha: aLas10("2026-11-12"), cantidad: 4, estado: null }];
    const mermas = [{ productoId: 2, fecha: aLas10("2026-11-14"), cajas: 1, stockAntes: 4 }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, mermas, entradas, lecturas }, HOY).evidencia[0]).toMatchObject({ gastado: 1.2 });
  });

  it("cómo llegó también va contado: la que llegó madura tenía la mitad de vida", () => {
    const revisiones = [{ productoId: 2, llegadaDia: "2026-11-13", estado: "maduro" as const, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") }];
    // Tres días con una vida de 2.5 → 1.2.
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones }, HOY).evidencia[0]).toMatchObject({ gastado: 1.2 });
  });

  it("lo que no se puede fechar no es evidencia: cajas de hace más de 45 días, o una merma de cajas más viejas que las entradas leídas", () => {
    const revisiones = [{ productoId: 2, llegadaDia: null, estado: null, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") }];
    const entradas = [{ productoId: 2, fecha: aLas10("2026-11-12"), cantidad: 4, estado: null }];
    const mermas = [{ productoId: 2, fecha: aLas10("2026-11-14"), cajas: 2, stockAntes: 9 }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones, mermas, entradas }, HOY)).toEqual({ evidencia: [], hayNueva: false });
  });

  it("solo cuenta lo de esa fruta y lo de los últimos 30 días, de lo más nuevo a lo más viejo", () => {
    const revisiones = [
      { productoId: 2, llegadaDia: "2026-10-01", estado: null, dia: "2026-10-08", creadoEn: aLas10("2026-10-08") },
      { productoId: 2, llegadaDia: "2026-11-01", estado: null, dia: "2026-11-07", creadoEn: aLas10("2026-11-07") },
      { productoId: 2, llegadaDia: "2026-11-09", estado: null, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") },
      { productoId: 7, llegadaDia: "2026-11-09", estado: null, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") },
    ];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones }, HOY).evidencia.map((e) => e.haceDias)).toEqual([1, 9]);
  });

  it("es nueva solo si pasó después de la última estimación: lo ya visto no vuelve a preguntar", () => {
    const vieja = [{ productoId: 2, llegadaDia: "2026-11-01", estado: null, dia: "2026-11-07", creadoEn: aLas10("2026-11-07") }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones: vieja }, HOY)).toMatchObject({ hayNueva: false });
    // La del mismo día de la estimación, pero de después de las 7 p. m., sí es nueva.
    const tarde = [{ productoId: 2, llegadaDia: "2026-11-05", estado: null, dia: "2026-11-10", creadoEn: "2026-11-11T01:30:00+00:00" }];
    expect(evidenciaDe(papaya, 5, desde, { ...sinHechos, revisiones: tarde }, HOY)).toMatchObject({ hayNueva: true });
  });
});

describe("frutasPorEstimar con evidencia", () => {
  const revisiones = [{ productoId: 2, llegadaDia: "2026-11-09", estado: null, dia: "2026-11-15", creadoEn: aLas10("2026-11-15") }];

  it("una fruta ya estimada vuelve al pedido solo si hay evidencia nueva, con lo que rige, su paso de esta noche y la evidencia", () => {
    const pedido = frutasPorEstimar([producto(1, "Mango", 4), producto(2, "Papaya", 2)], vigentes(1, 2), { ...sinHechos, revisiones }, HOY);
    expect(pedido).toEqual([{ id: 2, fruta: "Papaya", tabla: 5, actual: 5, minimo: 4, maximo: 6, evidencia: [{ tipo: "sigue_buena", haceDias: 1, gastado: 1.4 }] }]);
  });

  it("lo que pasa después de la estimación de hoy entra al pedido de mañana: hoy no se vuelve a preguntar", () => {
    const deHoy = new Map([[2, { dias: 5, motivo: "De esta noche.", dia: HOY, creadoEn: "2026-11-16T10:00:00+00:00" }]]);
    const despues = [{ productoId: 2, llegadaDia: "2026-11-09", estado: null, dia: HOY, creadoEn: "2026-11-16T20:00:00+00:00" }];
    expect(frutasPorEstimar([producto(2, "Papaya", 2)], deHoy, { ...sinHechos, revisiones: despues }, HOY)).toEqual([]);
    expect(frutasPorEstimar([producto(2, "Papaya", 2)], deHoy, { ...sinHechos, revisiones: despues }, "2026-11-17")).toHaveLength(1);
  });

  it("una fruta sin estimación se pide como nueva, tenga o no evidencia", () => {
    const pedido = frutasPorEstimar([producto(2, "Papaya", 2)], vigentes(), { ...sinHechos, revisiones }, HOY);
    expect(pedido).toEqual([{ id: 2, fruta: "Papaya", tabla: 5, minimo: 3, maximo: 7 }]);
  });
});

describe("aceptarEstimaciones de un ajuste", () => {
  const pedidas = [{ id: 2, fruta: "Papaya", tabla: 5, actual: 5, minimo: 4, maximo: 6, evidencia: [{ tipo: "sigue_buena" as const, haceDias: 1, gastado: 1.4 }] }];

  it("el ajuste de una noche no pasa de su paso, aunque el modelo pida más", () => {
    expect(aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 2, dias: 9, motivo: "Aguantó mucho más de lo calculado." }] })).toEqual([
      { productoId: 2, dias: 6, motivo: "Aguantó mucho más de lo calculado.", recortada: true },
    ]);
  });

  it("puede quedar igual: también se guarda, para no volver a preguntar por la misma evidencia", () => {
    expect(aceptarEstimaciones(pedidas, { estimaciones: [{ producto_id: 2, dias: 5, motivo: "Una sola revisión no alcanza para cambiarla." }] })).toEqual([
      { productoId: 2, dias: 5, motivo: "Una sola revisión no alcanza para cambiarla.", recortada: false },
    ]);
  });
});
