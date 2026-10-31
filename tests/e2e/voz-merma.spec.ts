import { expect, test } from "@playwright/test";

import { baseLocal } from "./base";
import { abastecer, comando, crearComando, dictar, stockDe } from "./dictar";

// Dictar una merma → tarjeta → Confirmar, contra la base local (A6). Cada prueba y cada ancho usan su propia fruta para
// que las corridas en paralelo no se pisen el stock, y ninguna es la de la prueba de venta.

const base = baseLocal();
const frutas = {
  conStock: { "s25-412": { id: 3, nombre: "Plátano de seda" }, "gama-media-360": { id: 5, nombre: "Papaya" } },
  sinStock: { "s25-412": { id: 7, nombre: "Mandarina" }, "gama-media-360": { id: 8, nombre: "Uva red globe" } },
} as const;
type Ancho = keyof typeof frutas.conStock;

const mermasDe = async (comandoId: number) =>
  (await base.from("movimientos_stock").select("producto_id, cantidad, motivo").eq("comando_voz_id", comandoId).eq("tipo", "merma")).data ?? [];

function tarjeta(fruta: { id: number; nombre: string } | null, cambios: Record<string, unknown> = {}) {
  return {
    tipo: "merma",
    producto: { dicho: fruta ? fruta.nombre.toLowerCase() : "uva", elegido: fruta, opciones: [] },
    cantidad: 2,
    motivo: "se pasó",
    falta: fruta ? [] : ["producto"],
    ...cambios,
  };
}

const dictarMerma = (page: Parameters<typeof dictar>[0], comandoId: number, t: ReturnType<typeof tarjeta>) => dictar(page, comandoId, t, "¿Así fue la merma?");

test("merma: dice cuántas cajas quedan y, con dos toques, la guarda una vez", async ({ page }, info) => {
  test.slow();
  const fruta = frutas.conStock[info.project.name as Ancho];
  await abastecer(fruta.id, 5);
  const antes = await stockDe(fruta.id);
  const comandoId = await crearComando("registrar_merma");
  const hoja = await dictarMerma(page, comandoId, tarjeta(fruta));

  await expect(hoja.getByRole("button", { name: new RegExp(`2 cajas de ${fruta.nombre}`) })).toBeVisible();
  await expect(hoja.getByText("«se pasó»")).toBeVisible();
  await expect(hoja.getByText(`Con esta merma te quedan ${antes - 2} cajas de ${fruta.nombre}`)).toBeVisible();

  const confirmar = hoja.getByRole("button", { name: "Confirmar merma" });
  await confirmar.evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByText("Merma guardada")).toBeVisible();
  await expect(page.getByText(`Te quedan ${antes - 2} cajas de ${fruta.nombre}`)).toBeVisible();

  // Lo que quedó en la base: una sola salida de 2 cajas, con su motivo, y el comando enlazado.
  expect(await mermasDe(comandoId)).toEqual([{ producto_id: fruta.id, cantidad: -2, motivo: "se pasó" }]);
  expect(await stockDe(fruta.id)).toBe(antes - 2);
  expect(await comando(comandoId)).toEqual({ resultado: "confirmado", latencia_ms: expect.any(Number) });
});

test("merma de más de lo que hay: avisa y se guarda; corregidas las cajas, el comando queda corregido", async ({ page }, info) => {
  test.slow();
  const fruta = frutas.sinStock[info.project.name as Ancho];
  const antes = await stockDe(fruta.id);
  const cajas = Math.max(antes, 0) + 2;
  const comandoId = await crearComando("registrar_merma");
  const hoja = await dictarMerma(page, comandoId, tarjeta(fruta, { cantidad: cajas }));

  // Sin stock (o con stock negativo), la tarjeta no dice «solo tenías -3 cajas»: dice que no quedaba.
  await expect(hoja.getByText(antes > 0 ? /Según la app solo tenías/ : `Según la app no te quedaba ${fruta.nombre}.`)).toBeVisible();
  await expect(hoja.getByText(`${antes - cajas} cajas`)).toBeVisible();

  await hoja.getByRole("button", { name: new RegExp(`${cajas} cajas de ${fruta.nombre}`) }).click();
  await expect(hoja.getByText("Precio de la caja")).toHaveCount(0); // una merma no lleva dinero
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByRole("button", { name: new RegExp(`${cajas + 1} cajas de ${fruta.nombre}`) })).toBeVisible();

  await hoja.getByRole("button", { name: "Confirmar merma" }).click();
  await expect(page.getByText("Merma guardada")).toBeVisible();

  expect(await mermasDe(comandoId)).toEqual([{ producto_id: fruta.id, cantidad: -(cajas + 1), motivo: "se pasó" }]);
  expect(await stockDe(fruta.id)).toBe(antes - (cajas + 1));
  expect((await comando(comandoId)).resultado).toBe("corregido");
});

test("sin saber qué fruta no se guarda: se elige de la lista, y descartar avisa qué no guardó", async ({ page }) => {
  test.slow();
  const comandoId = await crearComando("registrar_merma");
  const dudosa = tarjeta(null, {
    producto: { dicho: "uva", elegido: null, opciones: [{ id: 8, nombre: "Uva red globe" }, { id: 6, nombre: "Piña golden" }] },
  });
  const hoja = await dictarMerma(page, comandoId, dudosa);

  await expect(hoja.getByText("Falta elegir qué fruta se malogró.")).toBeVisible();
  await expect(hoja.getByRole("button", { name: "Confirmar merma" })).toBeDisabled();

  await hoja.getByRole("button", { name: /¿uva\?/ }).click();
  await hoja.getByRole("button", { name: /Uva red globe/ }).click();
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(hoja.getByRole("button", { name: "Confirmar merma" })).toBeEnabled();

  await hoja.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("No guardé esa merma.")).toBeVisible();
  expect(await mermasDe(comandoId)).toEqual([]);
});
