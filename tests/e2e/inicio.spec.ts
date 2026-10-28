import { expect, test } from "@playwright/test";

import { entrarComo } from "./cuentas";

test("la app abre y llega a la base", async ({ page }) => {
  await entrarComo(page, "duenio");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  // El vacío solo sale si la consulta a la base respondió; si no, sale un aviso.
  await expect(page.getByText("Aquí va a estar tu día")).toBeVisible();

  // Nunca hay scroll horizontal (CLAUDE.md, celular primero, regla 7).
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);
});
