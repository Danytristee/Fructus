import { describe, expect, it } from "vitest";

import { aceptarEstimaciones, frutasPorEstimar, limitesDe, TOPE_POR_NOCHE } from "./vida-estimada-reglas";

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

describe("frutasPorEstimar", () => {
  it("pide las frutas que todavía no tienen estimación, con su nombre completo y lo que dice la tabla", () => {
    const pedido = frutasPorEstimar([producto(1, "Mango", 4, { variedad: "Kent" }), producto(2, "Papaya", 2)], new Set([2]));
    expect(pedido).toEqual([{ id: 1, fruta: "Mango Kent", tabla: 7 }]);
  });

  it("no vuelve a preguntar lo que ya contestó: sin frutas nuevas no pide nada", () => {
    expect(frutasPorEstimar([producto(1, "Mango"), producto(2, "Papaya")], new Set([1, 2]))).toEqual([]);
  });

  it("primero las que tienen cajas en el puesto: son las que mueven el aviso de mañana", () => {
    const pedido = frutasPorEstimar([producto(1, "Pera"), producto(2, "Mango", 12), producto(3, "Uva"), producto(4, "Papaya", 3)], new Set());
    expect(pedido.map((f) => f.id)).toEqual([2, 4, 1, 3]);
  });

  it("una noche no pide más del tope: lo que falta entra la noche siguiente", () => {
    const muchos = Array.from({ length: TOPE_POR_NOCHE + 15 }, (_, i) => producto(i + 1, "Mango", 0, { calibre: String(i) }));
    expect(frutasPorEstimar(muchos, new Set())).toHaveLength(TOPE_POR_NOCHE);
  });

  it("una fruta que la tabla no conoce se pide con el valor de reserva (10 días)", () => {
    expect(frutasPorEstimar([producto(9, "Pitahaya")], new Set())[0]).toEqual({ id: 9, fruta: "Pitahaya", tabla: 10 });
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
    { id: 1, fruta: "Mango Kent", tabla: 7 },
    { id: 2, fruta: "Manzana Fuji", tabla: 30 },
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
