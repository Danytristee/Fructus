import { describe, expect, it } from "vitest";

import { formatearSoles } from "../formato";
import { respuestaQuienMeDebe } from "./consultas-reglas";

const deudores = [
  { id: 2, nombre: "Rosa Quispe", saldo: 100 },
  { id: 1, nombre: "Luis Paredes", saldo: 680 },
  { id: 4, nombre: "Bodega Santa Ana", saldo: 352 },
  { id: 5, nombre: "Carlos Mendoza", saldo: 160 },
  { id: 3, nombre: "Juguería El Paraíso", saldo: 140 },
  { id: 6, nombre: "Restaurante Mochica", saldo: 40.5 },
];

describe("respuestaQuienMeDebe", () => {
  it("un veredicto: cuánto te deben y entre cuántos, y los que más deben primero", () => {
    const r = respuestaQuienMeDebe(deudores);
    expect(r).toMatchObject({
      titulo: "Quién te debe",
      etiqueta: "Te deben",
      cifra: { tipo: "soles", valor: 1472.5, tono: "deuda" },
      detalle: "entre 6 clientes",
      mas: 1,
      enlace: { texto: "Ver todo el cuaderno", href: "/clientes" },
    });
    expect(r.filas.map((f) => f.nombre)).toEqual(["Luis Paredes", "Bodega Santa Ana", "Carlos Mendoza", "Juguería El Paraíso", "Rosa Quispe"]);
    expect(r.filas[0]).toEqual({ id: 1, nombre: "Luis Paredes", valor: formatearSoles(680), tono: "deuda" });
  });

  it("lo hablado dice los montos como se dicen y nombra al que más debe", () => {
    expect(respuestaQuienMeDebe(deudores).hablado).toBe(
      "Te deben mil cuatrocientos setenta y dos soles con cincuenta céntimos, entre seis clientes. El que más te debe es Luis Paredes, con seiscientos ochenta soles.",
    );
  });

  it("con un solo deudor no dice «entre uno»", () => {
    const r = respuestaQuienMeDebe([{ id: 1, nombre: "Luis Paredes", saldo: 21 }]);
    expect(r.detalle).toBe("solo Luis Paredes");
    expect(r.hablado).toBe("Solo te debe Luis Paredes: veintiún soles.");
  });

  it("los saldos en cero o a favor no son deudas", () => {
    const r = respuestaQuienMeDebe([
      { id: 1, nombre: "Luis Paredes", saldo: 0 },
      { id: 2, nombre: "Rosa Quispe", saldo: -70 },
    ]);
    expect(r).toMatchObject({ etiqueta: "Nadie te debe", cifra: null, filas: [], mas: 0, hablado: "Nadie te debe. Tu cuaderno está al día." });
  });
});
