import { describe, expect, it } from "vitest";

import {
  causasPara,
  causaVale,
  diferenciaConteo,
  efectoDeCausa,
  faltaConteo,
  frasesFaltaConteo,
  inicioContador,
  pedidoConteo,
  segunLaApp,
  veredictoConteo,
  type BorradorConteo,
} from "./confirmar-conteo-reglas";

const mango = { id: 1, nombre: "Mango Kent" };
const conteo = (cambios: Partial<BorradorConteo> = {}): BorradorConteo => ({ producto: mango, contado: 18, causa: null, ...cambios });

describe("diferencia y veredicto", () => {
  it("contado menos lo que dice la app, sin errores de coma", () => {
    expect(diferenciaConteo(18, 20)).toBe(-2);
    expect(diferenciaConteo(0.3, 0.1)).toBe(0.2);
  });

  it("lo dice como veredicto", () => {
    expect(veredictoConteo(20, 20)).toEqual({ tipo: "cuadra", cajas: 0, texto: "Cuadra con la app" });
    expect(veredictoConteo(18, 20)).toEqual({ tipo: "faltan", cajas: 2, texto: "Faltan 2 cajas" });
    expect(veredictoConteo(19, 20).texto).toBe("Falta 1 caja");
    expect(veredictoConteo(9, 5)).toEqual({ tipo: "sobran", cajas: 4, texto: "Sobran 4 cajas" });
    expect(veredictoConteo(6, 5).texto).toBe("Sobra 1 caja");
  });

  it("con stock negativo no muestra una cifra imposible", () => {
    expect(segunLaApp(20)).toBe("La app decía 20 cajas.");
    expect(segunLaApp(0)).toBe("La app no tenía ninguna caja.");
    expect(segunLaApp(-1186)).toBe("La app no tenía ninguna caja.");
  });

  it("el contador arranca en lo que dice la app, nunca debajo de cero", () => {
    expect(inicioContador(20)).toBe(20);
    expect(inicioContador(-1186)).toBe(0);
    expect(inicioContador(2.5)).toBe(2.5);
  });
});

describe("causas", () => {
  it("si faltan: se malogró, se vendió sin anotar o no sé", () => {
    expect(causasPara(-2).map((c) => c.valor)).toEqual(["se_malogro", "venta_sin_anotar", "no_se"]);
  });

  it("si sobran: llegó sin anotar o no sé", () => {
    expect(causasPara(3).map((c) => c.valor)).toEqual(["compra_sin_anotar", "no_se"]);
  });

  it("si cuadra, no hay causa que dar", () => {
    expect(causasPara(0)).toEqual([]);
  });

  it("una causa deja de valer si la diferencia cambia de signo", () => {
    expect(causaVale("se_malogro", -2)).toBe(true);
    expect(causaVale("se_malogro", 2)).toBe(false);
    expect(causaVale("no_se", 2)).toBe(true);
    expect(causaVale(null, -2)).toBe(false);
  });

  it("dice qué pasa con lo que se malogró y con lo que llegó", () => {
    expect(efectoDeCausa("se_malogro")).toBe("Se anota como merma.");
    expect(efectoDeCausa("compra_sin_anotar")).toContain("anótala aparte");
    expect(efectoDeCausa("no_se")).toBeNull();
  });
});

describe("qué falta", () => {
  it("sin fruta, primero la fruta", () => {
    expect(faltaConteo(conteo({ producto: null }), 20)).toEqual(["producto"]);
  });

  it("sin saber qué dice la app (sin señal) no se puede comparar", () => {
    expect(faltaConteo(conteo(), null)).toEqual(["stock"]);
    expect(frasesFaltaConteo(["stock"], null)).toContain("necesitas señal");
  });

  it("si no cuadra, falta la causa; y la frase dice si faltan o sobran", () => {
    expect(faltaConteo(conteo(), 20)).toEqual(["causa"]);
    expect(frasesFaltaConteo(["causa"], -2)).toBe("Elige por qué faltan.");
    expect(frasesFaltaConteo(["causa"], 3)).toBe("Elige por qué sobran.");
  });

  it("con su causa, o si cuadra, está listo", () => {
    expect(faltaConteo(conteo({ causa: "se_malogro" }), 20)).toEqual([]);
    expect(faltaConteo(conteo({ contado: 20 }), 20)).toEqual([]);
  });

  it("una causa que ya no explica la diferencia vuelve a faltar", () => {
    expect(faltaConteo(conteo({ contado: 22, causa: "se_malogro" }), 20)).toEqual(["causa"]);
  });
});

describe("pedidoConteo", () => {
  it("lleva lo contado y lo que decía la app al comparar, no la diferencia", () => {
    expect(pedidoConteo(conteo({ causa: "no_se" }), 7, 20)).toEqual({ p_producto_id: 1, p_contado: 18, p_causa: "no_se", p_comando_voz_id: 7, p_segun_app: 20 });
    expect(pedidoConteo(conteo({ contado: 20 }), 7, 20)).not.toHaveProperty("p_causa");
  });

  it("sin fruta, sin número o con un número imposible no hay pedido", () => {
    expect(pedidoConteo(conteo({ producto: null }), 7, 20)).toBeNull();
    expect(pedidoConteo(conteo({ contado: null }), 7, 20)).toBeNull();
    expect(pedidoConteo(conteo({ contado: -1 }), 7, 20)).toBeNull();
    expect(pedidoConteo(conteo({ contado: 5000 }), 7, 20)).toBeNull();
  });
});
