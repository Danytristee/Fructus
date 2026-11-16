import { describe, expect, it } from "vitest";

import {
  cajas,
  edadLoteMasViejo,
  evaluarProducto,
  juntarAlertas,
  listaDeStock,
  porUrgencia,
  priorizarAlertas,
  resumirInventario,
  type ProductoInventario,
} from "./inventario-reglas";
import { vidaUtilDias } from "./vida-util-reglas";

const hoy = new Date("2026-10-28T15:00:00Z");
const haceDias = (n: number) => new Date(hoy.getTime() - n * 86_400_000).toISOString();
const producto = (extra: Partial<ProductoInventario>): ProductoInventario => ({
  id: 1,
  nombre: "Manzana",
  variedad: "Royal",
  stock: 20,
  vendido7: 70,
  entradas: [{ fecha: haceDias(1), cantidad: 30 }],
  precioReferencia: 128.72,
  ...extra,
});

describe("vidaUtilDias", () => {
  it("por familia de fruta, sin importar tildes; lo desconocido dura 10 días", () => {
    expect(vidaUtilDias("Plátano")).toBe(6);
    expect(vidaUtilDias("Piña")).toBe(7);
    expect(vidaUtilDias("Maracuyá")).toBe(10);
  });
});

describe("edadLoteMasViejo", () => {
  it("lo primero que entra es lo primero que sale: las entradas recientes cubren el stock", () => {
    const entradas = [
      { fecha: haceDias(9), cantidad: 40 },
      { fecha: haceDias(3), cantidad: 20 },
      { fecha: haceDias(1), cantidad: 10 },
    ];
    expect(edadLoteMasViejo(25, entradas, hoy)).toBe(3); // 10 de ayer + 15 del lote de hace 3 días
    expect(edadLoteMasViejo(45, entradas, hoy)).toBe(9); // ya hace falta el lote de hace 9 días
    expect(edadLoteMasViejo(0, entradas, hoy)).toBeNull();
  });
});

describe("evaluarProducto", () => {
  it("una fruta que se vende y está fresca no tiene alertas", () => {
    expect(evaluarProducto(producto({}), hoy).alertas).toEqual([]);
  });

  it("papaya que llegó hace 5 días (dura 5): tiene que salir hoy, y dice que ya se pasó", () => {
    const e = evaluarProducto(producto({ nombre: "Papaya", variedad: null, stock: 10, vendido7: 14, entradas: [{ fecha: haceDias(5), cantidad: 20 }] }), hoy);
    const a = e.alertas.find((x) => x.tipo === "deterioro");
    expect(a).toMatchObject({ gravedad: "alta", titulo: "Papaya tiene que salir hoy", corto: "10 cajas del viernes" });
    expect(a?.detalle).toBe("10 cajas que llegaron el viernes. Su último día bueno fue ayer: revisa la fruta antes de venderla.");
    expect(a?.recomendacion).toContain("Véndelo hoy");
  });

  describe("el calor de cada día", () => {
    // Mango (dura 7 a temperatura normal) que llegó hace 4 días. Sin calor le quedan 2 días; con una semana de 31°, hoy es el último.
    const mango = producto({ nombre: "Mango", variedad: "Kent", stock: 12, vendido7: 63, entradas: [{ fecha: haceDias(4), cantidad: 12 }] });
    const semana = (grados: number) => [0, 1, 2, 3, 4].map((n) => ({ dia: haceDias(n).slice(0, 10), grados }));

    it("sin temperaturas anotadas cuenta como la tabla de siempre: no avisa todavía", () => {
      const e = evaluarProducto(mango, hoy);
      expect(e.alertas.filter((a) => a.tipo === "deterioro")).toEqual([]);
      expect(e.lotes).toMatchObject([{ cajas: 12, restan: 2, perdidos: 0 }]);
    });

    it("con una semana de calor fuerte la misma caja tiene que salir hoy, y dice cuánto le quitó el calor", () => {
      const e = evaluarProducto(mango, hoy, semana(31));
      const a = e.alertas.find((x) => x.tipo === "deterioro");
      expect(a).toMatchObject({ gravedad: "alta", titulo: "Mango Kent tiene que salir hoy" });
      expect(a?.detalle).toBe("12 cajas que llegaron el sábado. El calor le quitó 2 días: hoy es su último día bueno.");
    });

    it("lo que se acaba mañana se avisa como «sale mañana», para ponerlo adelante", () => {
      const e = evaluarProducto(mango, hoy, semana(28));
      expect(e.alertas.find((x) => x.tipo === "deterioro")).toMatchObject({ gravedad: "media", titulo: "Mango Kent sale mañana", recomendacion: "Ponlo adelante y véndelo primero." });
    });

    // /chaos 2026-11-14: con la única entrada de hace 120 días (fuera de los 45 que se leen), la fila decía «4 cajas» sin barra,
    // sin «Sale hoy» y sin aviso de frescura. La fruta más vieja del puesto era la que se quedaba callada.
    it("las cajas que las entradas leídas no cubren son de hace más de 45 días: piden revisarse hoy", () => {
      const vieja = producto({ nombre: "Manzana", variedad: "Royal", stock: 4, vendido7: 0, entradas: [] });
      const e = evaluarProducto(vieja, hoy);
      expect(e.lotes).toMatchObject([{ cajas: 4, antes: true, restan: 0 }]);
      expect(e.desgaste).toBe(1);
      const a = e.alertas.find((x) => x.tipo === "deterioro");
      expect(a).toMatchObject({ gravedad: "alta", titulo: "Manzana Royal tiene que salir hoy", corto: "4 cajas de hace más de 45 días" });
      expect(a?.detalle).toBe("4 cajas que llegaron hace más de 45 días. Revisa la fruta antes de venderla.");
      // Ni con semanas de fresco (la manzana aguantaría más de 45 días a 16°) se le hace la cuenta: no se sabe cuándo llegó.
      const fresco = Array.from({ length: 46 }, (_, n) => ({ dia: haceDias(n).slice(0, 10), grados: 16 }));
      expect(evaluarProducto(vieja, hoy, fresco).lotes).toMatchObject([{ antes: true, restan: 0 }]);
    });

    it("si una fruta mezcla cajas viejas y nuevas, las llegadas suman el total de la fila", () => {
      const mezcla = producto({ nombre: "Manzana", variedad: "Royal", stock: 10, vendido7: 7, entradas: [{ fecha: haceDias(2), cantidad: 6 }] });
      const e = evaluarProducto(mezcla, hoy);
      expect(e.lotes.map((l) => [l.cajas, l.antes ?? false, l.restan > 0])).toEqual([[4, true, false], [6, false, true]]);
      expect(e.lotes.reduce((s, l) => s + l.cajas, 0)).toBe(10);
      // El aviso habla solo de las 4 viejas.
      expect(e.alertas.find((x) => x.tipo === "deterioro")?.corto).toBe("4 cajas de hace más de 45 días");
    });

    it("cada llegada lleva su cuenta: lo viejo sale hoy y lo nuevo aguanta", () => {
      const dos = producto({ nombre: "Mango", variedad: "Kent", stock: 42, vendido7: 63, entradas: [{ fecha: haceDias(4), cantidad: 20 }, { fecha: haceDias(1), cantidad: 30 }] });
      const e = evaluarProducto(dos, hoy, semana(31));
      expect(e.lotes.map((l) => [l.cajas, l.restan])).toEqual([[12, 0], [30, 3]]);
      // El aviso habla solo de las 12 que salen hoy, no de las 42.
      expect(e.alertas.find((x) => x.tipo === "deterioro")?.corto).toBe("12 cajas del sábado");
    });

    it("cómo llegó cambia cuánto aguanta: la madura del lunes sale antes que la verde del sábado", () => {
      const dos = producto({
        nombre: "Mango",
        variedad: "Kent",
        stock: 30,
        vendido7: 63,
        entradas: [
          { fecha: haceDias(4), cantidad: 20, estado: "verde" },
          { fecha: haceDias(2), cantidad: 10, estado: "maduro" },
        ],
      });
      const e = evaluarProducto(dos, hoy, semana(31));
      // Primero la que se acaba antes, no la que llegó antes.
      expect(e.lotes.map((l) => [l.estado, l.cajas, l.restan])).toEqual([["maduro", 10, 0], ["verde", 20, 2]]);
      expect(e.alertas.find((x) => x.tipo === "deterioro")).toMatchObject({ titulo: "Mango Kent tiene que salir hoy", corto: "10 cajas del lunes, maduras" });
    });

    it("una sola caja se dice en singular", () => {
      const una = producto({ nombre: "Mango", variedad: "Kent", stock: 1, vendido7: 63, entradas: [{ fecha: haceDias(4), cantidad: 1 }] });
      expect(evaluarProducto(una, hoy, semana(31)).alertas.find((x) => x.tipo === "deterioro")?.detalle).toMatch(/^1 caja que llegó el sábado\./);
    });
  });

  it("kiwi con 80 cajas y 2 al día: sobrestock, no compres más", () => {
    const e = evaluarProducto(producto({ nombre: "Kiwi", variedad: "Cope", stock: 80, vendido7: 14, entradas: [{ fecha: haceDias(2), cantidad: 80 }] }), hoy);
    const a = e.alertas.find((x) => x.tipo === "sobrestock");
    expect(a?.gravedad).toBe("alta");
    expect(a?.detalle).toContain("no alcanzan a venderse");
    expect(a?.recomendacion).toContain("No compres más");
  });

  it("manzana con 6 cajas y 10 al día: te queda poco, compra para 4 días", () => {
    const e = evaluarProducto(producto({ stock: 6, vendido7: 70 }), hoy);
    const a = e.alertas.find((x) => x.tipo === "reponer");
    expect(a).toMatchObject({ gravedad: "alta", recomendacion: "Compra unas 34 cajas para cubrir 4 días." });
    expect(e.coberturaDias).toBeCloseTo(0.6);
  });

  it("sin stock y con demanda: se acabó", () => {
    expect(evaluarProducto(producto({ stock: 0 }), hoy).alertas[0]).toMatchObject({ tipo: "reponer", titulo: "Se acabó Manzana Royal" });
  });

  it("con stock de hace más de 7 días y sin ventas en esos 7 días: no se está vendiendo", () => {
    expect(evaluarProducto(producto({ vendido7: 0, entradas: [{ fecha: haceDias(8), cantidad: 30 }] }), hoy).alertas[0]?.tipo).toBe("sin_movimiento");
  });

  it("stock sin entradas en 45 días (es viejo) y sin ventas: pide revisarse hoy y, además, no se está vendiendo", () => {
    expect(evaluarProducto(producto({ vendido7: 0, entradas: [] }), hoy).alertas.map((a) => a.tipo)).toEqual(["deterioro", "sin_movimiento"]);
  });

  it("cajas que llegaron hace menos de 7 días todavía no son «sin vender en 7 días» (2026-11-10: 20 cajas de hoy salían como sin movimiento)", () => {
    for (const d of [0, 3, 6]) {
      const alertas = evaluarProducto(producto({ vendido7: 0, entradas: [{ fecha: haceDias(d), cantidad: 20 }] }), hoy).alertas;
      expect(alertas.map((a) => a.tipo), `${d} días`).not.toContain("sin_movimiento");
    }
  });
});

describe("cajas y días enteros, como se dice en el puesto", () => {
  it("«unas 136 cajas», no «136.3»; lo que no llega a una, en palabras", () => {
    expect(cajas(136.3)).toBe("136 cajas");
    expect(cajas(1)).toBe("1 caja");
    expect(cajas(0.7)).toBe("menos de una caja");
  });
});

describe("priorizarAlertas y resumirInventario", () => {
  const productos = [
    producto({ id: 1, stock: 6, vendido7: 70 }),
    producto({ id: 2, nombre: "Papaya", variedad: null, stock: 10, vendido7: 14, entradas: [{ fecha: haceDias(5), cantidad: 20 }], precioReferencia: 48.27 }),
    // De hace 7 días: todavía aguanta (el kaki dura 10) y ya cuenta como «sin vender en 7 días».
    producto({ id: 3, nombre: "Kaki", variedad: null, stock: 4, vendido7: 0, entradas: [{ fecha: haceDias(7), cantidad: 4 }], precioReferencia: 112.63 }),
  ];
  const estados = productos.map((p) => evaluarProducto(p, hoy));

  it("lo que se malogra va antes que lo que falta, y lo grave antes que lo medio", () => {
    expect(priorizarAlertas(estados).map((a) => `${a.gravedad} ${a.tipo}`)).toEqual(["alta deterioro", "alta reponer", "media sin_movimiento"]);
  });

  it("el resumen cuenta cajas, valor y alertas", () => {
    expect(resumirInventario(productos, estados)).toMatchObject({ cajas: 20, valor: 1705.54, alertasAltas: 2, frutasPorMalograrse: 1, porReponer: 1 });
  });
});

describe("cifras de urgencia que cuadran (/formidable 2026-11-10)", () => {
  it("cada recuadro cuenta lo mismo que su filtro, y aparte cuántas son para hoy", () => {
    const productos = [
      producto({ id: 1, nombre: "Caqui", variedad: null, stock: 6, vendido7: 7, entradas: [{ fecha: haceDias(9), cantidad: 6 }] }), // por malograrse, hoy
      producto({ id: 2, nombre: "Durazno", variedad: null, stock: 7, vendido7: 0, entradas: [{ fecha: haceDias(5), cantidad: 7 }] }), // por malograrse, pronto
    ];
    const estados = productos.map((p) => evaluarProducto(p, hoy));
    const { porTipo } = resumirInventario(productos, estados);
    const filtro = priorizarAlertas(estados).filter((a) => a.tipo === "deterioro").length;
    expect(porTipo.deterioro).toEqual({ total: filtro, hoy: 1 });
    expect(filtro).toBe(2);
  });
});

describe("porUrgencia", () => {
  // Decisión del 16-11, sobre maquetas: «Qué hacer» se parte en dos grupos y el título del grupo dice la urgencia. Antes cada
  // tarjeta llevaba su etiqueta roja «Hoy» y la pestaña, un número que no cuadraba para quien lo veía por primera vez.
  const productos = [
    producto({ id: 1, nombre: "Papaya", variedad: null, stock: 10, vendido7: 14, entradas: [{ fecha: haceDias(5), cantidad: 20 }] }), // tiene que salir hoy
    producto({ id: 2, stock: 0, vendido7: 14, entradas: [] }), // se acabó: comprar hoy
    producto({ id: 3, nombre: "Kaki", variedad: null, stock: 4, vendido7: 0, entradas: [{ fecha: haceDias(7), cantidad: 4 }] }), // no se vende: puede esperar
    producto({ id: 4, nombre: "Membrillo", variedad: null, stock: 3, vendido7: 0, entradas: [{ fecha: haceDias(7), cantidad: 3 }] }), // igual
  ];
  const alertas = priorizarAlertas(productos.map((p) => evaluarProducto(p, hoy)));

  it("lo grave va en «para hoy» y lo demás en «puede esperar», cada grupo con sus tarjetas", () => {
    const { paraHoy, puedeEsperar } = porUrgencia(alertas);
    expect(paraHoy.map((g) => `${g.tipo} ${g.alertas.length}`)).toEqual(["deterioro 1", "reponer 1"]);
    expect(puedeEsperar.map((g) => `${g.tipo} ${g.alertas.length}`)).toEqual(["sin_movimiento 2"]);
    expect([...paraHoy, ...puedeEsperar].every((g) => g.gravedad === (paraHoy.includes(g) ? "alta" : "media"))).toBe(true);
  });

  it("cuenta los avisos que esperan, fruta por fruta, para el botón que los abre", () => {
    expect(porUrgencia(alertas).avisosQueEsperan).toBe(2);
    expect(porUrgencia([])).toEqual({ paraHoy: [], puedeEsperar: [], avisosQueEsperan: 0 });
  });
});

describe("juntarAlertas", () => {
  const sobra = (id: number, nombre: string, stock: number) =>
    producto({ id, nombre, variedad: null, stock, vendido7: 7, entradas: [{ fecha: haceDias(1), cantidad: stock }] });

  it("las del mismo tipo y urgencia van en una tarjeta, con una recomendación y el dato de cada fruta", () => {
    const estados = [sobra(1, "Kiwi", 80), sobra(2, "Tuna", 40), sobra(3, "Piña", 30)].map((p) => evaluarProducto(p, hoy));
    const grupos = juntarAlertas(priorizarAlertas(estados));
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.titulo).toBe("Te sobran 3 frutas");
    expect(grupos[0]!.recomendacion).toMatch(/^No compres más hasta que bajen/);
    expect(grupos[0]!.detalle).toBe("");
    // Cada fruta lleva su propio dato, el mismo que dice su alerta suelta: «56 cajas de más».
    expect(grupos[0]!.alertas.map((a) => a.productoId)).toEqual([1, 2, 3]);
    expect(grupos[0]!.alertas.every((a) => /^\d+ cajas? de más$/.test(a.corto))).toBe(true);
  });

  it("una sola alerta queda como estaba, con su título y su detalle", () => {
    const [a] = evaluarProducto(sobra(1, "Kiwi", 80), hoy).alertas;
    const [g] = juntarAlertas([a!]);
    expect(g).toMatchObject({ titulo: a!.titulo, detalle: a!.detalle, recomendacion: a!.recomendacion });
  });

  it("lo urgente y lo que puede esperar no se mezclan, y se respeta el orden de prioridad", () => {
    const estados = [
      producto({ id: 1, nombre: "Caqui", variedad: null, stock: 6, vendido7: 7, entradas: [{ fecha: haceDias(9), cantidad: 6 }] }),
      producto({ id: 2, nombre: "Durazno", variedad: null, stock: 7, vendido7: 7, entradas: [{ fecha: haceDias(5), cantidad: 7 }] }),
    ].map((p) => evaluarProducto(p, hoy));
    const alertas = priorizarAlertas(estados);
    const grupos = juntarAlertas(alertas);
    // Ningún grupo mezcla urgencias ni tipos, y van en el orden en que priorizarAlertas los puso.
    for (const g of grupos) expect(g.alertas.every((a) => a.tipo === g.tipo && a.gravedad === g.gravedad)).toBe(true);
    const orden = [...new Set(alertas.map((a) => `${a.gravedad} ${a.tipo}`))];
    expect(grupos.map((g) => `${g.gravedad} ${g.tipo}`)).toEqual(orden);
    expect(orden.slice(0, 1)).toEqual(["alta deterioro"]);
  });
});

describe("listaDeStock", () => {
  const e = (id: number, nombre: string, variedad: string | null, stock: number, extra: Partial<ProductoInventario> = {}) =>
    evaluarProducto(producto({ id, nombre, variedad, stock, vendido7: 0, entradas: [], ...extra }), hoy);

  it("dice qué variedades de una fruta no tienen cajas, y qué frutas no tienen ninguna", () => {
    const { grupos, frutasSinCajas } = listaDeStock([
      e(1, "Manzana", "Verde", 39, { seleccion: "Comercial" }),
      e(2, "Manzana", "Verde", 0, { seleccion: "Premium" }),
      e(3, "Cereza", "chilena", 0),
      e(4, "Albaricoque", null, 0, { seleccion: "Extra" }),
    ]);
    expect(grupos).toEqual([expect.objectContaining({ fruta: "Manzana", cajas: 39, sinCajas: ["Verde Premium"] })]);
    expect(grupos[0]!.conCajas.map((x) => x.id)).toEqual([1]);
    expect(frutasSinCajas).toEqual(["Albaricoque", "Cereza"]);
  });

  it("si dos sin cajas se llaman igual, se distinguen por el calibre", () => {
    const { grupos } = listaDeStock([
      e(1, "Manzana", "Roja americana", 0, { seleccion: "Premium", calibre: "113" }),
      e(2, "Manzana", "Roja americana", 5, { seleccion: "Premium", calibre: "100" }),
    ]);
    expect(grupos[0]!.sinCajas).toEqual(["Roja americana Premium cal.\u00a0113"]);
  });

  it("un stock negativo no es «sin cajas»: queda como fila en su fruta y no resta del total (/chaos 2026-11-10)", () => {
    const { grupos, frutasSinCajas } = listaDeStock([
      e(1, "Durazno", "chileno", -3, { calibre: "40" }),
      e(2, "Kiwi", "Riñón", 33),
      e(3, "Kiwi", "Cilíndrico", -2),
    ]);
    expect(frutasSinCajas).toEqual([]);
    expect(grupos.map((g) => [g.fruta, g.cajas, g.conCajas.map((x) => x.id), g.sinCajas])).toEqual([
      ["Durazno", 0, [1], []],
      ["Kiwi", 33, [3, 2], []],
    ]);
  });

  it("con stock negativo, «alcanza para» dice 0 días, no −4.2", () => {
    expect(e(1, "Durazno", "chileno", -3, { vendido7: 5 }).coberturaDias).toBe(0);
  });
});
