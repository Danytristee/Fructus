import { describe, expect, it } from "vitest";

import { listarFrutas, palancas, porQue, TITULOS } from "./negociacion-reglas";
import {
  analizarProveedores,
  nivelClienteFijo,
  nivelDependencia,
  posicionDe,
  resumirProveedores,
  type CompraResumida,
  type FrutaComprada,
} from "./proveedores-reglas";

// 12 nov 2026, 10 a. m. en Lima (UTC−5).
const HOY = new Date("2026-11-12T15:00:00Z");
const haceDias = (d: number) => new Date(HOY.getTime() - d * 86_400_000).toISOString();

/** Una compra cada `cada` días, de `desde` hasta `hasta` días atrás. */
function compras(proveedorId: number | null, cada: number, desde: number, hasta: number, total: number): CompraResumida[] {
  const lista: CompraResumida[] = [];
  for (let d = desde; d >= hasta; d -= cada) lista.push({ proveedorId, fecha: haceDias(d), total });
  return lista;
}
const fruta = (proveedorId: number, productoId: number, nombre: string, ultimoCosto: number, extra: Partial<FrutaComprada> = {}): FrutaComprada => ({
  proveedorId,
  productoId,
  fruta: nombre,
  cajas: 30,
  total: ultimoCosto * 30,
  ultimoCosto,
  costoPromedio: ultimoCosto,
  ...extra,
});

const PACIFICO = { id: 1, nombre: "Importadora Frutícola del Pacífico", saldo: 2800 };
const ANDINA = { id: 2, nombre: "Distribuidora Andina Import", saldo: 0 };
const CHAO = { id: 3, nombre: "Agrícola Chao", saldo: 0 };
const LAMBAYEQUE = { id: 4, nombre: "Comercial Lambayeque", saldo: 0 };

describe("nivelDependencia", () => {
  it("es alto si se lleva un cuarto de tus compras o te trae algo que nadie más", () => {
    expect(nivelDependencia(0.3, 0)).toBe("alto");
    expect(nivelDependencia(0.02, 1)).toBe("alto");
    expect(nivelDependencia(0.12, 0)).toBe("medio");
    expect(nivelDependencia(0.05, 0)).toBe("bajo");
  });
});

describe("nivelClienteFijo", () => {
  it("es alto si le compras cada semana o menos, desde hace dos meses, y hasta ahora", () => {
    expect(nivelClienteFijo(4, 120, 1)).toBe("alto");
    expect(nivelClienteFijo(10, 90, 3)).toBe("medio");
    expect(nivelClienteFijo(20, 90, 3)).toBe("bajo");
  });
  it("deja de serlo si hace tres semanas que no le compras, aunque antes fuera seguido", () => {
    expect(nivelClienteFijo(4, 120, 25)).toBe("bajo");
  });
  it("sin dos compras no hay frecuencia: no se inventa", () => {
    expect(nivelClienteFijo(null, 10, 10)).toBe("bajo");
  });
});

describe("posicionDe", () => {
  it("riesgo: dependes de él y no eres su cliente fijo", () => expect(posicionDe("alto", "bajo", 0, 3)).toBe("riesgo"));
  it("riesgo: es tu única fuente de algo, aunque le compres seguido", () => expect(posicionDe("alto", "alto", 1, 3)).toBe("riesgo"));
  it("socio: se necesitan los dos", () => expect(posicionDe("alto", "alto", 0, 3)).toBe("socio"));
  it("ventaja: eres su cliente fijo y no dependes de él", () => expect(posicionDe("medio", "alto", 0, 3)).toBe("ventaja"));
  it("ocasional: ni uno ni otro", () => expect(posicionDe("bajo", "bajo", 0, 10)).toBe("ocasional"));
  it("enfriado: más de 30 días sin comprarle manda sobre todo lo demás", () => expect(posicionDe("alto", "alto", 1, 45)).toBe("enfriado"));
});

describe("analizarProveedores", () => {
  const todas = [
    ...compras(1, 3, 120, 1, 1000), // Pacífico: mucho y seguido
    ...compras(2, 9, 85, 4, 400), // Andina: de vez en cuando
    ...compras(3, 4, 120, 2, 300), // Chao: seguido, poco
    ...compras(4, 6, 118, 52, 200), // Lambayeque: se enfrió
    ...compras(null, 30, 60, 0, 100), // compras sin proveedor anotado
  ];
  const frutas = [
    fruta(1, 10, "Manzana Roja americana", 182, { costoPromedio: 172 }),
    fruta(1, 11, "Kiwi chileno", 196),
    fruta(2, 10, "Manzana Roja americana", 168),
    fruta(3, 12, "Uva sin pepa", 98),
    fruta(2, 12, "Uva sin pepa", 95),
    fruta(3, 14, "Tumbo", 45, { cajas: 4, total: 180 }),
    fruta(4, 13, "Pepino", 28),
  ];
  const [pacifico, chao, andina, lambayeque] = analizarProveedores([ANDINA, PACIFICO, CHAO, LAMBAYEQUE], todas, frutas, HOY);

  it("ordena por cuánto le compras en los últimos 90 días", () => {
    expect([pacifico!.nombre, chao!.nombre, andina!.nombre, lambayeque!.nombre]).toEqual([PACIFICO.nombre, CHAO.nombre, ANDINA.nombre, LAMBAYEQUE.nombre]);
  });

  it("la parte de cada uno cuenta también las compras sin proveedor: los porcentajes no se inflan", () => {
    const suma = [pacifico, chao, andina, lambayeque].reduce((s, a) => s + a!.participacion, 0);
    expect(suma).toBeLessThan(1);
    expect(suma).toBeGreaterThan(0.99);
  });

  it("el Pacífico: dependes de él y es tu única fuente de kiwi → busca otra opción", () => {
    expect(pacifico!.dependes).toBe("alto");
    expect(pacifico!.cadaDias).toBe(3);
    expect(pacifico!.frutas.find((f) => f.fruta === "Kiwi chileno")!.unicaFuente).toBe(true);
    expect(pacifico!.posicion).toBe("riesgo");
  });

  it("el Pacífico es S/ 14 más caro en la manzana que Andina, y eso es ahorro posible al mes", () => {
    const manzana = pacifico!.frutas.find((f) => f.productoId === 10)!;
    expect(manzana.mejorOtro).toEqual({ proveedorId: 2, costo: 168 });
    expect(manzana.diferencia).toBe(14);
    expect(pacifico!.ahorroMensual).toBe(140); // 14 × 30 cajas en 90 días = 420 → 140 al mes
    expect(manzana.subio).toBeCloseTo(182 / 172 - 1);
  });

  it("ser la única fuente del tumbo (menos del 5 % de tus compras) no te ata a Chao", () => {
    expect(chao!.frutas.find((f) => f.fruta === "Tumbo")!.unicaFuente).toBe(true);
    expect(chao!.dependes).not.toBe("alto");
  });

  it("Chao: le compras cada 4 días desde hace 4 meses → eres su cliente fijo, pide mejor precio", () => {
    expect(chao!.clienteFijo).toBe("alto");
    expect(chao!.posicion).toBe("ventaja");
  });

  it("Lambayeque: hace 52 días que no le compras → se enfrió", () => {
    expect(lambayeque!.diasSinComprar).toBe(52);
    expect(lambayeque!.posicion).toBe("enfriado");
  });

  it("un proveedor sin compras sale en cero, sin frecuencia ni antigüedad inventadas", () => {
    const [nuevo] = analizarProveedores([{ id: 9, nombre: "Nuevo", saldo: 0 }], todas, frutas, HOY);
    expect(nuevo).toMatchObject({ total: 0, participacion: 0, cadaDias: null, antiguedadDias: null, posicion: "ocasional" });
    expect(porQue(nuevo!)).toBe("Todavía no le compras nada.");
  });

  it("el resumen nombra al que más pesa y suma lo que debes", () => {
    const resumen = resumirProveedores([pacifico!, chao!, andina!, lambayeque!]);
    expect(resumen.principal!.nombre).toBe(PACIFICO.nombre);
    expect(resumen.deuda).toBe(2800);
    expect(resumen.conDeuda).toBe(1);
    expect(resumen.enRiesgo).toBe(1);
  });

  it("los porqués y las palancas se dicen en lenguaje de puesto", () => {
    expect(TITULOS[pacifico!.posicion]).toBe("Busca otra opción");
    expect(porQue(pacifico!)).toBe("Es el único que te trae Kiwi chileno. Si te falla, te quedas sin eso.");
    expect(porQue(chao!)).toBe("Le compras cada 4 días desde hace 4 meses y tienes otras opciones: eres su cliente fijo.");
    const nombres = new Map([[2, "Andina"]]);
    expect(palancas(pacifico!, (id) => nombres.get(id) ?? "?").map((p) => p.texto)).toEqual([
      "Andina te deja Manzana Roja americana a S/ 14 menos por caja.",
      "Si iguala el mejor precio, ahorras unos S/ 140 al mes.",
      "Te subió Manzana Roja americana: su último precio está 6 % sobre su promedio.",
      "Le debes S/ 2,800: pagar a tiempo te da pie para pedir rebaja.",
    ]);
  });
});

describe("listarFrutas", () => {
  it("nombra dos y cuenta el resto", () => {
    expect(listarFrutas(["kiwi"])).toBe("kiwi");
    expect(listarFrutas(["kiwi", "cereza"])).toBe("kiwi y cereza");
    expect(listarFrutas(["kiwi", "cereza", "uva", "pera"])).toBe("kiwi, cereza y 2 más");
  });
});
