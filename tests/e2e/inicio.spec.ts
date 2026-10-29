import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

test("la app abre y llega a la base", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  // El resumen solo sale si la base respondió; si no, sale un aviso.
  await expect(page.getByText("Cobraste")).toBeVisible();
  await expect(page.getByText("No pudimos leer tu día")).toHaveCount(0);

  // Nunca hay scroll horizontal (CLAUDE.md, celular primero, regla 7).
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);
});
