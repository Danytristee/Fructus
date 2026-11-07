import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";
import { filtrosSinCortes, medir } from "./medir";

// El tablero de Stock (A8, /formidable del 5-11): el anillo dice de qué es, las palabras son de puesto y los filtros no se esconden.
// Lee lo que haya en la base local: no crea nada.

test.setTimeout(60_000);

test("el anillo dice «X de Y frutas» y debajo «sin avisos», sin un porcentaje suelto", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Tu stock" })).toBeVisible({ timeout: 30_000 });

  const anillo = page.getByRole("figure", { name: /frutas sin avisos/ });
  await expect(anillo).toBeVisible();
  await expect(anillo).toHaveAttribute("aria-label", /^\d+ de \d+ frutas sin avisos$/);
  // Dice QUÉ se cuenta (frutas, no avisos ni cajas) y qué se dice de ellas. «Sin avisos» es exacto: «bien» sonaba a otra cosa y
  // chocaba con «0 por malograrse» (una fruta con aviso de reponer o de sobra tampoco está «bien»).
  await expect(anillo).toContainText(/^\d+ de \d+\s*frutas$/);
  await expect(anillo).not.toContainText("%");
  await expect(page.getByText("sin avisos", { exact: true })).toBeVisible();
  await expect(page.getByText(/están bien/)).toHaveCount(0);
});

test("Stock habla como el puesto: «te sobran», no «sobrestock»", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Tu stock" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("te sobran", { exact: true })).toBeVisible();
  await expect(page.getByText(/sobrestock/i)).toHaveCount(0);
});

test("los filtros de las alertas se ven enteros: lo que no entra en una fila pasa a la siguiente", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { name: "Qué hacer hoy" })).toBeVisible({ timeout: 30_000 });
  const { cortados, desliza } = await filtrosSinCortes(page, "Filtrar alertas");
  expect(cortados, "opciones cortadas").toEqual([]);
  expect(desliza, "no debe deslizarse de lado").toBeLessThanOrEqual(0);
  const { desborde, chicos } = await medir(page);
  expect(desborde).toBeLessThanOrEqual(0);
  expect(chicos, "controles de menos de 48 px").toEqual([]);
});
