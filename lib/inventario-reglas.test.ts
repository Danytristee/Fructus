import { describe, expect, it } from "vitest";

import { cajas, edadLoteMasViejo, evaluarProducto, priorizarAlertas, resumirInventario, veredictoDelStock, vidaUtilDias, type ProductoInventario } from "./inventario-reglas";

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

  it("papaya de 5 días (dura 5): se está por malograr, véndela hoy", () => {
    const e = evaluarProducto(producto({ nombre: "Papaya", variedad: null, stock: 10, vendido7: 14, entradas: [{ fecha: haceDias(5), cantidad: 20 }] }), hoy);
    const a = e.alertas.find((x) => x.tipo === "deterioro");
    expect(a).toMatchObject({ gravedad: "alta", titulo: "Papaya se está por malograr" });
    expect(a?.recomendacion).toContain("Véndelo hoy");
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

  it("con stock y sin ventas en 7 días: no se está vendiendo", () => {
    expect(evaluarProducto(producto({ vendido7: 0 }), hoy).alertas[0]?.tipo).toBe("sin_movimiento");
  });
});

describe("cajas y días enteros, como se dice en el puesto", () => {
  it("«unas 136 cajas», no «136.3»; lo que no llega a una, en palabras", () => {
    expect(cajas(136.3)).toBe("136 cajas");
    expect(cajas(1)).toBe("1 caja");
    expect(cajas(0.7)).toBe("menos de una caja");
  });
});

describe("veredictoDelStock", () => {
  const sana = { stock: 10, alertas: [] };
  const conAviso = { stock: 10, alertas: [{ tipo: "sobrestock" }] } as unknown as Parameters<typeof veredictoDelStock>[0][number];
  const agotada = { stock: 0, alertas: [{ tipo: "reponer" }] } as unknown as Parameters<typeof veredictoDelStock>[0][number];
  it("cuenta las frutas CON aviso, también las que se acabaron", () => {
    expect(veredictoDelStock([sana, conAviso, agotada])).toEqual({ conAviso: 2, total: 3, sanas: 1 });
  });
  it("una fruta sin stock y sin aviso no se cuenta: no se lleva", () => {
    expect(veredictoDelStock([sana, { stock: 0, alertas: [] }])).toEqual({ conAviso: 0, total: 1, sanas: 1 });
  });
});

describe("priorizarAlertas y resumirInventario", () => {
  const productos = [
    producto({ id: 1, stock: 6, vendido7: 70 }),
    producto({ id: 2, nombre: "Papaya", variedad: null, stock: 10, vendido7: 14, entradas: [{ fecha: haceDias(5), cantidad: 20 }], precioReferencia: 48.27 }),
    producto({ id: 3, nombre: "Kaki", variedad: null, stock: 4, vendido7: 0, precioReferencia: 112.63 }),
  ];
  const estados = productos.map((p) => evaluarProducto(p, hoy));

  it("lo que se malogra va antes que lo que falta, y lo grave antes que lo medio", () => {
    expect(priorizarAlertas(estados).map((a) => `${a.gravedad} ${a.tipo}`)).toEqual(["alta deterioro", "alta reponer", "media sin_movimiento"]);
  });

  it("el resumen cuenta cajas, valor y alertas", () => {
    expect(resumirInventario(productos, estados)).toEqual({ cajas: 20, valor: 1705.54, alertasAltas: 2, frutasPorMalograrse: 1, porReponer: 1 });
  });
});
