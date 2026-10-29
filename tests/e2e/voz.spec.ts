import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

test("el botón de voz vive abajo al centro, mide 96 px o más, escucha al mantenerlo y avisa al soltar", async ({ page }) => {
  await entrarComo(page, "duenio");
  const voz = page.getByRole("button", { name: "Botón de voz" });
  await expect(voz).toBeVisible();

  const caja = (await voz.boundingBox())!;
  const pantalla = page.viewportSize()!;
  expect(caja.width).toBeGreaterThanOrEqual(96);
  expect(Math.abs(caja.x + caja.width / 2 - pantalla.width / 2)).toBeLessThanOrEqual(2); // al centro
  expect(caja.y).toBeGreaterThan((pantalla.height * 2) / 3 - caja.height); // en el tercio de abajo

  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await expect(voz).toHaveAttribute("data-estado", "escuchando");
  await expect(page.locator("#voz-texto")).toContainText("Te escucho");
  await page.mouse.up();
  await expect(voz).toHaveAttribute("data-estado", "entendiendo");
  await expect(page.locator("#voz-texto")).toHaveText("La voz llega muy pronto");
  await expect(voz).toHaveAttribute("data-estado", "listo");
});

test("la etiqueta enseña la primera vez y, después de usarlo, deja de tapar «Lo último»", async ({ page }) => {
  await entrarComo(page, "duenio");
  const etiqueta = page.locator("#voz-texto");
  await expect(etiqueta).toHaveText("Mantén para hablar");
  await expect(etiqueta).toHaveCSS("opacity", "1");

  const voz = page.getByRole("button", { name: "Botón de voz" });
  await voz.dispatchEvent("pointerdown", { pointerId: 1 });
  await voz.dispatchEvent("pointerup", { pointerId: 1 });
  await expect(etiqueta).toHaveText("La voz llega muy pronto");

  await page.reload();
  await expect(page.getByText("Cobraste")).toBeVisible();
  await expect(etiqueta).toHaveCSS("opacity", "0");
  // Oculta a la vista, el lector de pantalla la sigue teniendo.
  await expect(etiqueta).toHaveText("Mantén para hablar");

  // Al bajar hasta el final, la última fila de «Lo último» queda por encima del orbe.
  await page.getByTestId("lo-ultimo").getByRole("listitem").last().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const ultima = (await page.getByTestId("lo-ultimo").getByRole("listitem").last().boundingBox())!;
  const orbe = (await voz.boundingBox())!;
  expect(ultima.y + ultima.height).toBeLessThanOrEqual(orbe.y);
});

test("con la etiqueta visible, «Clientes» y «Stock» de la barra se pueden tocar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.locator("#voz-texto")).toHaveCSS("opacity", "1");
  const barra = page.getByRole("navigation", { name: "Principal" });
  await barra.getByRole("link", { name: "Clientes" }).click({ timeout: 5_000 });
  await expect(page).toHaveURL("/clientes");
  await page.goto("/");
  await barra.getByRole("link", { name: "Stock" }).click({ timeout: 5_000 });
  await expect(page).toHaveURL("/stock");
});
