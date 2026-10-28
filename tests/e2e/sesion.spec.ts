import { expect, test } from "@playwright/test";

import { CLAVE_PRUEBA, cuentas, entrarComo } from "./cuentas";

test("sin sesión, cualquier pantalla manda a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Fructus" })).toBeVisible();
});

test("una clave equivocada se dice claro y no borra el correo", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // que React termine de montarse antes de escribir
  await page.getByLabel("Correo").fill(cuentas.duenio);
  await page.getByLabel("Clave", { exact: true }).fill("no-es-la-clave");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "El correo o la clave no coinciden" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveValue(cuentas.duenio);
  await expect(page).toHaveURL("/login");
});

test("un correo mal escrito se marca en su campo", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // que React termine de montarse antes de escribir
  await page.getByLabel("Correo").fill("duenio-sin-arroba");
  await page.getByLabel("Clave", { exact: true }).fill(CLAVE_PRUEBA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Escribe un correo válido")).toBeVisible();
});

test("entra, la sesión se mantiene al recargar y sale", async ({ page }) => {
  await entrarComo(page, "duenio");
  await page.reload();
  await expect(page).toHaveURL("/");

  // Con sesión, /login devuelve a la app.
  await page.goto("/login");
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: /^Menú/ }).click();
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("el login entra a 360 px sin scroll horizontal y con controles de 48 px", async ({ page }) => {
  await page.goto("/login");
  // Se mide al terminar la entrada: durante la animación la tarjeta está a escala 0.985.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity));
  const medidas = await page.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - innerWidth,
    // El botón de herramientas de Next solo existe en desarrollo.
    chicos: [...document.querySelectorAll("button, a, input")].filter((e) => !e.closest("nextjs-portal") && !e.getAttribute("aria-label")?.startsWith("Open Next.js")).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.width < 48 || r.height < 48);
    }).length,
  }));
  expect(medidas).toEqual({ desborde: 0, chicos: 0 });
});
