import { expect, test } from "@playwright/test";

test("la app abre y llega a la base", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fructus" })).toBeVisible();
  await expect(page.getByTestId("estado-base")).toHaveText("La base responde.");

  // Nunca hay scroll horizontal (CLAUDE.md, celular primero, regla 7).
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);
});
