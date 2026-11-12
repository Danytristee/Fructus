import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./cuentas";

async function medir(page: Page) {
  // Se mide al terminar la entrada: durante la animación todo está a escala 0.985.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  return page.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - innerWidth,
    chicos: [...document.querySelectorAll("button, a, input")]
      .filter((e) => !e.closest("nextjs-portal") && !e.getAttribute("aria-label")?.startsWith("Open Next.js"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.width < 48 || r.height < 48);
      })
      .map((e) => e.textContent?.trim()),
  }));
}

test.beforeEach(async ({ page }) => {
  await entrarComo(page, "duenio");
});

test("la barra de abajo lleva a los 4 destinos y marca el actual", async ({ page }) => {
  const barra = page.getByRole("navigation", { name: "Principal" });
  await expect(barra.getByRole("link")).toHaveText(["Hoy", "Clientes", "Stock", "Ventas"]);
  await expect(barra.getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "page");

  for (const [nombre, ruta, titulo] of [
    ["Clientes", "/clientes", "Clientes"],
    ["Stock", "/stock", "Stock"],
    ["Ventas", "/ventas", "Ventas"],
    ["Hoy", "/", "Hoy"],
  ] as const) {
    await barra.getByRole("link", { name: nombre }).click();
    await expect(page).toHaveURL(ruta);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(barra.getByRole("link", { name: nombre })).toHaveAttribute("aria-current", "page");
    expect(await medir(page)).toEqual({ desborde: 0, chicos: [] });
  }
});

test("el menú abre Proveedores, Cierre y Ajustes, y la barra no marca ninguno", async ({ page }) => {
  await page.getByRole("button", { name: /^Menú/ }).click();
  const menu = page.getByRole("dialog", { name: "Más" });
  await expect(menu.getByRole("link")).toHaveText(["Proveedores", "Cierre del día", "Ajustes"]);
  await expect(menu.getByRole("button", { name: "Salir" })).toBeVisible();

  await menu.getByRole("link", { name: "Cierre del día" }).click();
  await expect(page).toHaveURL("/cierre");
  await expect(page.getByRole("heading", { level: 1, name: "Cierre del día" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Solo lo que se ve: en celular el panel lateral del escritorio (ADR-0015) está en el HTML pero escondido, y él sí marca Cierre.
  await expect(page.locator('nav[aria-label="Principal"] [aria-current]').filter({ visible: true })).toHaveCount(0);

  await page.getByRole("button", { name: /^Menú/ }).click();
  await page.getByRole("dialog", { name: "Más" }).getByRole("link", { name: "Proveedores" }).click();
  await expect(page).toHaveURL("/proveedores");
  await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();

  await page.getByRole("button", { name: /^Menú/ }).click();
  await page.getByRole("dialog", { name: "Más" }).getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL("/ajustes");
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
});
