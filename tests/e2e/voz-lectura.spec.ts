import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";
import { dichas, distintas, sintetizadorDePrueba, terminarFrase } from "./manos-libres";

// Manos libres (ADR-0020): con el interruptor prendido, la venta lista se lee en voz alta al abrir la tarjeta. El sintetizador del
// navegador se reemplaza por uno que anota lo que se le pide decir y termina la frase cuando la prueba quiere.

const lista = {
  tipo: "venta",
  cliente: { dicho: "don lucho", elegido: { id: 1, nombre: "Luis Paredes" }, opciones: [] },
  items: [{ producto: { dicho: "mango", elegido: { id: 1, nombre: "Mango Kent" }, opciones: [] }, cantidad: 10, precio: { valor: 45, sugerido: false }, subtotal: 450 }],
  descuento: 0,
  total: 450,
  condicion: "credito",
  medio: null,
  comprobante: "ninguno",
  dudas: [],
  falta: [],
};
const LECTURA = "10 cajas de Mango Kent, a 45 la caja, para Luis Paredes. Total, 450 soles. Lo debe. ¿Confirmo?";

async function abrirTarjeta(page: Page, tarjeta: unknown) {
  await page.route("/api/voz", (ruta) => ruta.fulfill({ status: 200, json: { comandoId: 51, tarjeta, latenciaMs: 900 } }));
  await page.waitForLoadState("networkidle");
  const orbe = page.locator("button[data-estado]");
  const tocar = async () => {
    const caja = (await orbe.boundingBox())!;
    await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2, { delay: 60 });
  };
  await tocar();
  await expect(orbe).toHaveAttribute("data-bloqueado", "true", { timeout: 10_000 });
  // «Bloqueado» llega al soltar el dedo; el micrófono, unos cientos de ms después. Tocar antes es tocar sin haber grabado nada.
  await expect(orbe).toHaveAttribute("data-estado", "escuchando", { timeout: 10_000 });
  await page.waitForTimeout(800);
  await tocar();
  const hoja = page.getByRole("dialog", { name: "¿Así fue la venta?" });
  await expect(hoja).toBeVisible({ timeout: 15_000 });
  return hoja;
}

test("con manos libres, la venta lista se lee en voz alta y la tarjeta dice que la está leyendo", async ({ page }) => {
  test.slow(); // la primera vez compila la hoja
  await sintetizadorDePrueba(page, { manosLibres: true });
  await entrarComo(page, "duenio");
  const hoja = await abrirTarjeta(page, lista);
  await expect.poll(() => distintas(page)).toEqual([LECTURA]);
  await expect(hoja.getByRole("status").filter({ hasText: "Te la estoy leyendo" })).toBeVisible();
  await terminarFrase(page);
  await expect(hoja.getByText("Te la estoy leyendo")).toHaveCount(0);
  // Confirmar sigue ahí, como siempre: leer no guarda nada.
  await expect(hoja.getByRole("button", { name: "Confirmar venta" })).toBeEnabled();
});

test("tocar la tarjeta mientras lee la calla", async ({ page }) => {
  await sintetizadorDePrueba(page, { manosLibres: true });
  await entrarComo(page, "duenio");
  const hoja = await abrirTarjeta(page, lista);
  await expect(hoja.getByText("Te la estoy leyendo")).toBeVisible();
  await hoja.getByText("10 cajas de Mango Kent").click();
  await expect(page.getByText("Te la estoy leyendo")).toHaveCount(0);
});

test("lo incompleto no se lee: dice qué falta y se elige en la tarjeta", async ({ page }) => {
  await sintetizadorDePrueba(page, { manosLibres: true });
  await entrarComo(page, "duenio");
  const sinPrecio = { ...lista, items: [{ ...lista.items[0]!, precio: { valor: null, sugerido: false }, subtotal: null }], total: null, falta: ["precio"] };
  const hoja = await abrirTarjeta(page, sinPrecio);
  await expect(hoja.getByText("Toca para poner el precio")).toBeVisible();
  // Sin el total ni «¿Confirmo?»: lo que no está completo no se lee (si solo falta saber si pagó, se pregunta: voz-candados.spec.ts).
  await expect.poll(() => distintas(page)).toEqual(["Falta elegir a cuánto la caja. Míralo en la tarjeta."]);
});

test("sin manos libres no se lee nada", async ({ page }) => {
  await sintetizadorDePrueba(page, { manosLibres: false });
  await entrarComo(page, "duenio");
  await abrirTarjeta(page, lista);
  await page.waitForTimeout(500);
  expect(await dichas(page)).toEqual([]);
});

test("el interruptor del menú lo prende en este celular, lo dice en voz alta y lo recuerda", async ({ page }) => {
  await sintetizadorDePrueba(page, { manosLibres: false });
  await entrarComo(page, "ayudante");
  const abrirMenu = async () => {
    await page.getByRole("button", { name: /^Menú:/ }).click();
    return page.getByRole("switch", { name: /Manos libres/ });
  };
  const interruptor = await abrirMenu();
  await expect(interruptor).toHaveAttribute("aria-checked", "false");
  await interruptor.click();
  await expect(interruptor).toHaveAttribute("aria-checked", "true");
  await expect(interruptor).toContainText("Activado");
  expect(await dichas(page)).toEqual(["Listo. Te voy a leer cada venta antes de guardarla."]);

  await page.reload();
  await expect(await abrirMenu()).toHaveAttribute("aria-checked", "true");
});

test("quien solo lee (el contador) no ve el interruptor", async ({ page }) => {
  await entrarComo(page, "contador");
  await page.getByRole("button", { name: /^Menú:/ }).click();
  await expect(page.getByRole("dialog", { name: "Más" })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Manos libres/ })).toHaveCount(0);
});
