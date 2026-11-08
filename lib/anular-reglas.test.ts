import { describe, expect, it } from "vitest";

import { consecuenciasDeAnular, leerMotivo, motivoLimpio, MOTIVOS_RAPIDOS } from "./anular-reglas";

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

describe("leerMotivo", () => {
  it("un motivo de la lista se guarda con su texto, sin pedir nada más", () => {
    expect(leerMotivo("doble", "")).toEqual({ ok: true, motivo: "Se registró dos veces" });
    expect(leerMotivo("devolucion", "ignorado")).toEqual({ ok: true, motivo: "El cliente la devolvió" });
  });

  it("sin elegir no es un error: falta elegir", () => {
    expect(leerMotivo(null, "")).toEqual({ ok: false, error: null });
  });

  it("«Otro motivo» pide que se cuente, entre 3 y 200 letras, sin espacios de más", () => {
    expect(leerMotivo("otro", "")).toEqual({ ok: false, error: null });
    expect(leerMotivo("otro", "ay")).toEqual({ ok: false, error: "Cuéntalo con 3 letras o más." });
    expect(leerMotivo("otro", "  se   cayó  la caja ")).toEqual({ ok: true, motivo: "se cayó la caja" });
    expect(leerMotivo("otro", "x".repeat(201))).toEqual({ ok: false, error: "El motivo no puede pasar de 200 letras." });
    expect(leerMotivo("otro", "x".repeat(200)).ok).toBe(true);
  });

  it("todos los motivos de la lista caben en lo que la base acepta", () => {
    for (const m of MOTIVOS_RAPIDOS.filter((m) => m.clave !== "otro")) {
      expect(m.texto.length).toBeGreaterThanOrEqual(3);
      expect(m.texto.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("motivoLimpio", () => {
  it("limpia los espacios y rechaza lo que la base rechazaría", () => {
    expect(motivoLimpio("  Se   registró dos veces ")).toBe("Se registró dos veces");
    expect(motivoLimpio("   ")).toBeNull();
    expect(motivoLimpio("ay")).toBeNull();
    expect(motivoLimpio("x".repeat(201))).toBeNull();
  });
});

describe("consecuenciasDeAnular", () => {
  const credito = {
    total: 450,
    condicion: "credito" as const,
    cliente: { id: 1, nombre: "Luis Paredes", tipoDocumento: null, telefono: null },
    items: [{ producto: "Mango Kent", cantidad: 10, precio: 45, descuento: 0, subtotal: 450 }],
  };

  it("al crédito dice que la fruta vuelve al stock y cuánto menos te debe el cliente", () => {
    expect(consecuenciasDeAnular(credito, soles)).toEqual(["Vuelven al stock 10 cajas de mango kent.", "Luis Paredes te debe S/ 450.00 menos."]);
  });

  it("al contado dice cuánto se descuenta de lo vendido", () => {
    const contado = { ...credito, condicion: "contado" as const, cliente: null, total: 77 };
    expect(consecuenciasDeAnular(contado, soles)).toEqual(["Vuelven al stock 10 cajas de mango kent.", "Se descuentan S/ 77.00 de lo que vendiste."]);
  });

  it("con muchas frutas nombra las dos primeras y cuenta el resto", () => {
    const item = (producto: string) => ({ producto, cantidad: 1, precio: 10, descuento: 0, subtotal: 10 });
    const varias = { ...credito, items: [item("Mango Kent"), item("Papaya"), item("Uva"), item("Piña")] };
    expect(consecuenciasDeAnular(varias, soles)[0]).toBe("Vuelven al stock 1 caja de mango kent y 1 caja de papaya y 2 más.");
  });
});
