import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";
import { crearComando, dictar } from "./dictar";

// Lo que se espera de cualquier app del celular: tocar la pestaña en la que ya estás sube al inicio, mantener «+» sigue sumando, cada
// toque de la barra o de «+/−» vibra corto, y al tocar un monto se selecciona para reemplazarlo.

/** Anota cada `navigator.vibrate` (Chrome sin pantalla no vibra). */
async function anotarVibraciones(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vibraciones: number[] };
    w.__vibraciones = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (ms: number) => {
        w.__vibraciones.push(ms);
        return true;
      },
    });
  });
}
const vibraciones = (page: Page) => page.evaluate(() => (window as unknown as { __vibraciones: number[] }).__vibraciones);

const tarjeta = {
  tipo: "venta",
  cliente: { dicho: null, elegido: null, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: true }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "contado",
  medio: "efectivo",
  comprobante: "ninguno",
  dudas: [],
  falta: [],
};

async function editarCajas(page: Page) {
  const hoja = await dictar(page, await crearComando(), tarjeta, "¿Así fue la venta?");
  await hoja.getByRole("button", { name: /10 cajas de Mango Kent/ }).click();
  const cajas = hoja.getByRole("group", { name: "Cajas" }).getByRole("status");
  await expect(cajas).toHaveText("10");
  return { hoja, cajas };
}

test("tocar la pestaña en la que estás sube al inicio de la lista y vibra; desde una ficha, vuelve a la lista", async ({ page }) => {
  await anotarVibraciones(page);
  await entrarComo(page, "duenio");
  const barra = page.getByRole("navigation", { name: "Principal" });
  await barra.getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL("/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();

  await page.getByRole("button", { name: /^Todos/ }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);

  await barra.getByRole("link", { name: "Clientes" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveURL("/clientes");
  expect(await vibraciones(page)).toContain(8);

  // Desde la ficha de un cliente, la misma pestaña lleva a la lista.
  await page.locator('main a[href^="/clientes/"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/);
  await barra.getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL("/clientes");
});

test("mantener apretado «+» sigue sumando cajas; soltar lo detiene", async ({ page }) => {
  test.slow();
  await anotarVibraciones(page);
  const { hoja, cajas } = await editarCajas(page);
  const mas = (await hoja.getByRole("button", { name: "Una caja más" }).boundingBox())!;
  await page.mouse.move(mas.x + mas.width / 2, mas.y + mas.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  const despues = Number(await cajas.textContent());
  // 450 ms de espera y después un paso cada 120 ms: en 1.2 s suma unas 6. Un toque solo habría sumado 1.
  expect(despues).toBeGreaterThanOrEqual(13);
  await page.waitForTimeout(500);
  await expect(cajas, "al soltar se detiene").toHaveText(String(despues));
  expect((await vibraciones(page)).filter((ms) => ms === 8).length).toBeGreaterThanOrEqual(despues - 10);
});

test("un toque en «+» o «−» es exactamente una caja", async ({ page }) => {
  test.slow();
  const { hoja, cajas } = await editarCajas(page);
  await hoja.getByRole("button", { name: "Una caja más" }).click();
  await expect(cajas).toHaveText("11");
  await hoja.getByRole("button", { name: "Una caja menos" }).click();
  await hoja.getByRole("button", { name: "Una caja menos" }).click();
  await expect(cajas).toHaveText("9");
});

test("al tocar el precio, el número queda seleccionado y lo que escribes lo reemplaza", async ({ page }) => {
  test.slow();
  const { hoja } = await editarCajas(page);
  const precio = hoja.getByLabel("Precio de la caja");
  await expect(precio).toHaveValue("45");
  await precio.click();
  expect(await precio.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 2]);
  await page.keyboard.type("47");
  await expect(precio).toHaveValue("47");
});
