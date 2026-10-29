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
