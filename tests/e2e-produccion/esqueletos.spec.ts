import { expect, test } from "@playwright/test";

import { entrarComo } from "../e2e/cuentas";

// Tocar una pantalla responde AL INSTANTE: el esqueleto (app/(app)/loading.tsx) ya lo tenía el teléfono, precargado con los enlaces de la
// barra de abajo, así que se ve antes de que el servidor conteste. Se prueba compilado (en desarrollo no hay precarga) y atrasando a propósito
// la respuesta del servidor: lo que se ve entretanto es lo que la app ya tenía, no lo que el servidor mandó.

/** Espera a que Next haya precargado el enlace (lo hace solo, unos segundos después de abrir la pantalla): sin eso, tocar enseguida no tiene qué mostrar. */
const esperarPrecarga = (page: import("@playwright/test").Page, ruta: string) =>
  page.waitForFunction((r) => performance.getEntriesByType("resource").some((e) => e.name.includes(`${r}?_rsc=`)), ruta, { timeout: 20_000 });

test("al tocar «Clientes» se ve el esqueleto sin esperar al servidor, y después llega la pantalla de verdad", async ({ page }) => {
  await entrarComo(page, "duenio");
  await esperarPrecarga(page, "/clientes");

  // Solo se atrasa el pedido de la pantalla (no las precargas): 2.5 s de servidor lento.
  await page.route(/\/clientes\?_rsc=/, async (ruta) => {
    if (ruta.request().headers()["next-router-prefetch"]) return ruta.continue();
    await new Promise((r) => setTimeout(r, 2500));
    return ruta.continue();
  });

  const antes = Date.now();
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Clientes" }).click();
  const esqueleto = page.locator('[role="status"][aria-busy="true"]');
  await expect(esqueleto).toBeVisible({ timeout: 1500 });
  expect(Date.now() - antes, "el esqueleto se ve mucho antes de que conteste el servidor").toBeLessThan(2000);
  await expect(esqueleto).toContainText("Cargando");

  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible({ timeout: 15_000 });
  await expect(esqueleto).toHaveCount(0);
});

test("el esqueleto cabe en el celular: sin desborde y sin nada que se mueva fuera de su lugar", async ({ page }) => {
  await entrarComo(page, "duenio");
  await esperarPrecarga(page, "/stock");
  await page.route(/\/stock\?_rsc=/, async (ruta) => {
    if (ruta.request().headers()["next-router-prefetch"]) return ruta.continue();
    await new Promise((r) => setTimeout(r, 2500));
    return ruta.continue();
  });
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Stock" }).click();
  await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible({ timeout: 1500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("al volver a «Hoy» también se ve el esqueleto al instante", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.goto("/clientes");
  await esperarPrecarga(page, "/");
  await page.route(/\/\?_rsc=/, async (ruta) => {
    if (ruta.request().headers()["next-router-prefetch"]) return ruta.continue();
    await new Promise((r) => setTimeout(r, 2500));
    return ruta.continue();
  });
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Hoy" }).click();
  await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole("heading", { level: 1, name: "Hoy" })).toBeVisible({ timeout: 15_000 });
});
